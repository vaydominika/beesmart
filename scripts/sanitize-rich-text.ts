import { prisma } from "../lib/db";
import { sanitizeRichTextHtml } from "../lib/security/rich-text";

const apply = process.argv.includes("--apply");
let lessonsChanged = 0;
let postsChanged = 0;

try {
  const lessons = await prisma.courseLesson.findMany({ select: { id: true, content: true, contentDraft: true } });
  for (const lesson of lessons) {
    const content = lesson.content == null ? null : sanitizeRichTextHtml(lesson.content) || null;
    const contentDraft = lesson.contentDraft == null ? null : sanitizeRichTextHtml(lesson.contentDraft) || null;
    if (content === lesson.content && contentDraft === lesson.contentDraft) continue;
    lessonsChanged++;
    if (apply) await prisma.courseLesson.update({ where: { id: lesson.id }, data: { content, contentDraft } });
  }

  const posts = await prisma.classroomPost.findMany({ where: { content: { not: null } }, select: { id: true, content: true } });
  for (const post of posts) {
    const content = sanitizeRichTextHtml(post.content) || null;
    if (content === post.content) continue;
    postsChanged++;
    if (apply) await prisma.classroomPost.update({ where: { id: post.id }, data: { content } });
  }

  console.log(JSON.stringify({ event: "rich_text_sanitize_complete", mode: apply ? "apply" : "dry-run", lessonsChanged, postsChanged }));
} finally {
  await prisma.$disconnect();
}
