import { deepseek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { z } from "zod";
import { richTextToPlainText } from "@/lib/security/rich-text";

const lessonReferenceSchema = z.string().nullable().describe(
  "Exact lesson ID from the supplied course, or null for a course-wide finding",
);

export const coursePublishIssueSchema = z.object({
  lessonId: lessonReferenceSchema,
  category: z.enum(["STRUCTURE", "TOPIC_SAFETY", "CONTENT_SAFETY", "ACCESSIBILITY"]),
  reason: z.string().min(1).describe("A concise statement of what prevents publication, without advice or suggestions"),
});

export const coursePublishAuditSchema = z.object({
  publishable: z.boolean().describe("Whether the supplied course is safe and complete enough to publish"),
  blockingIssues: z.array(coursePublishIssueSchema).describe("Only issues that must prevent publication; never include tips or optional improvements"),
});

export type CoursePublishIssue = z.infer<typeof coursePublishIssueSchema>;
export type CoursePublishAudit = z.infer<typeof coursePublishAuditSchema>;

export interface PublishAuditCourse {
  title: string;
  description: string | null;
  modules: Array<{
    title: string;
    description: string | null;
    lessons: Array<{
      id: string;
      title: string;
      description: string | null;
      content: string | null;
      contentDraft: string | null;
    }>;
  }>;
}

export class CoursePublishAuditUnavailableError extends Error {
  constructor() {
    super("The publishing safety check could not be completed.");
    this.name = "CoursePublishAuditUnavailableError";
  }
}

export function findStructuralPublishBlockers(course: PublishAuditCourse): CoursePublishIssue[] {
  const issues: CoursePublishIssue[] = [];
  if (!course.title.trim()) {
    issues.push({ lessonId: null, category: "STRUCTURE", reason: "The course has no title." });
  }
  if (course.modules.length === 0) {
    issues.push({ lessonId: null, category: "STRUCTURE", reason: "The course has no modules." });
  }

  for (const courseModule of course.modules) {
    if (!courseModule.title.trim()) {
      issues.push({ lessonId: null, category: "STRUCTURE", reason: "A module has no title." });
    }
    if (courseModule.lessons.length === 0) {
      issues.push({ lessonId: null, category: "STRUCTURE", reason: `The module “${courseModule.title || "Untitled module"}” has no lessons.` });
    }
    for (const lesson of courseModule.lessons) {
      const draftText = richTextToPlainText(lesson.contentDraft ?? lesson.content ?? "").trim();
      if (!lesson.title.trim()) {
        issues.push({ lessonId: lesson.id, category: "STRUCTURE", reason: "A lesson has no title." });
      }
      if (!draftText) {
        issues.push({ lessonId: lesson.id, category: "STRUCTURE", reason: `The lesson “${lesson.title || "Untitled lesson"}” has no content.` });
      }
    }
  }
  return issues;
}

export async function auditCourseForPublishing(course: PublishAuditCourse): Promise<CoursePublishAudit> {
  const structuralIssues = findStructuralPublishBlockers(course);
  if (structuralIssues.length > 0) return { publishable: false, blockingIssues: structuralIssues };

  const courseText = course.modules.map((courseModule) => {
    const lessons = courseModule.lessons.map((lesson) => {
      const content = richTextToPlainText(lesson.contentDraft ?? lesson.content ?? "");
      return `[LESSON ID: ${lesson.id}; TITLE: ${lesson.title}]\n${lesson.description ?? ""}\n${content}`;
    }).join("\n\n");
    return `## MODULE: ${courseModule.title}\n${courseModule.description ?? ""}\n\n${lessons}`;
  }).join("\n\n---\n\n");

  try {
    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: coursePublishAuditSchema,
      system: [
        "You are the final publication safety gate for BeeSmart, an educational platform.",
        "Decide only whether the course may be published. Check that its topic and framing are appropriate for learning, and block unsafe, hateful, sexually explicit, illegal, dangerously misleading, or otherwise harmful material.",
        "Legitimate academic discussion of sensitive subjects may pass when it is responsibly framed.",
        "Also block content that is fundamentally unreadable or inaccessible, but do not grade teaching quality.",
        "Return only genuine publication blockers. Never provide scores, praise, tips, recommendations, rewrites, or optional improvements.",
        "When a blocker belongs to one lesson, copy its exact lesson ID. Use null for a course-wide blocker.",
      ].join(" "),
      prompt: `Course title: ${course.title}\nCourse description: ${course.description ?? ""}\n\n${courseText.substring(0, 30_000)}`,
    });

    const blockingIssues = object.blockingIssues;
    if (!object.publishable && blockingIssues.length === 0) {
      return {
        publishable: false,
        blockingIssues: [{ lessonId: null, category: "CONTENT_SAFETY", reason: "The course did not pass the publication safety check." }],
      };
    }
    return { publishable: object.publishable && blockingIssues.length === 0, blockingIssues };
  } catch (error) {
    console.error("course_publish_audit_failed", error);
    throw new CoursePublishAuditUnavailableError();
  }
}
