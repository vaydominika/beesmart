import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { auditCourseForPublishing, CoursePublishAuditUnavailableError, coursePublishAuditSchema, findStructuralPublishBlockers, type PublishAuditCourse } from "./course-audit";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));

const completeCourse: PublishAuditCourse = {
  title: "Cell biology",
  description: "An introduction to cells.",
  modules: [{
    title: "Cells",
    description: null,
    lessons: [{
      id: "lesson-1",
      title: "Cell structure",
      description: null,
      content: "<p>Published content</p>",
      contentDraft: "<p>Updated draft content</p>",
    }],
  }],
};

describe("course publication audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a blocker-only publication decision", () => {
    const result = coursePublishAuditSchema.safeParse({
      publishable: false,
      blockingIssues: [{
        lessonId: null,
        category: "TOPIC_SAFETY",
        reason: "The course promotes harmful activity.",
      }],
    });

    expect(result.success).toBe(true);
  });

  it("does not add optional advice fields to the schema", () => {
    const result = coursePublishAuditSchema.parse({ publishable: true, blockingIssues: [] });
    expect(result).toEqual({ publishable: true, blockingIssues: [] });
    expect(result).not.toHaveProperty("suggestions");
    expect(result).not.toHaveProperty("score");
  });

  it("checks draft content and blocks incomplete course structure before publication", () => {
    expect(findStructuralPublishBlockers(completeCourse)).toEqual([]);
    const issues = findStructuralPublishBlockers({
      ...completeCourse,
      modules: [{ ...completeCourse.modules[0], lessons: [{ ...completeCourse.modules[0].lessons[0], contentDraft: "" }] }],
    });
    expect(issues).toEqual([expect.objectContaining({ lessonId: "lesson-1", category: "STRUCTURE" })]);
  });

  it("checks a structurally complete course with the safety model", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { publishable: true, blockingIssues: [] },
    } as never);

    await expect(auditCourseForPublishing(completeCourse)).resolves.toEqual({ publishable: true, blockingIssues: [] });
    expect(generateObject).toHaveBeenCalledOnce();
  });

  it("fails closed when the safety model is unavailable", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("offline"));

    await expect(auditCourseForPublishing(completeCourse)).rejects.toBeInstanceOf(CoursePublishAuditUnavailableError);
  });
});
