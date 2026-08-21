import { NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canAccessCourse, canManageCourse, getLessonAccess } from "@/lib/course-access";
import { readPrivateFile } from "@/lib/files/storage";
import { isAdminUser } from "@/lib/admin";

type RouteContext = { params: Promise<{ fileId: string }> };

export const runtime = "nodejs";

function disposition(fileName: string, inline: boolean) {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "download";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fileId } = await ctx.params;

  const file = await prisma.storedFile.findUnique({
    where: { id: fileId },
    include: {
      courseCover: { select: { id: true } },
      courseFile: {
        include: {
          course: { select: { id: true } },
          lesson: { select: { id: true, moduleId: true, module: { select: { courseId: true } } } },
        },
      },
      postFile: { include: { post: { select: { classroomId: true } } } },
      submissionFile: {
        include: { submission: { select: { userId: true, assignedWork: { select: { classroomId: true } } } } },
      },
      reportAttachment: { include: { report: { select: { userId: true } } } },
    },
  });
  if (!file || file.state === "DELETE_PENDING" || !["CLEAN", "NOT_REQUIRED"].includes(file.scanStatus)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let allowed = file.state === "PENDING" && file.ownerId === userId;
  if (!allowed && file.courseCover) allowed = await canAccessCourse(file.courseCover.id, userId);
  if (!allowed && file.courseFile) {
    const courseId = file.courseFile.courseId ?? file.courseFile.lesson?.module.courseId;
    if (courseId && await canManageCourse(courseId, userId)) allowed = true;
    else if (courseId && file.courseFile.isVisible && await canAccessCourse(courseId, userId)) {
      if (file.courseFile.lesson) {
        const access = await getLessonAccess({
          courseId, moduleId: file.courseFile.lesson.moduleId, lessonId: file.courseFile.lesson.id, userId,
        });
        allowed = access.allowed;
      } else allowed = true;
    }
  }
  if (!allowed && file.postFile) {
    allowed = Boolean(await prisma.classroomMember.findUnique({
      where: { userId_classroomId: { userId, classroomId: file.postFile.post.classroomId } }, select: { id: true },
    }));
  }
  if (!allowed && file.submissionFile) {
    const submission = file.submissionFile.submission;
    allowed = submission.userId === userId;
    if (!allowed && submission.assignedWork.classroomId) {
      const membership = await prisma.classroomMember.findUnique({
        where: { userId_classroomId: { userId, classroomId: submission.assignedWork.classroomId } }, select: { role: true },
      });
      allowed = Boolean(membership && membership.role !== "STUDENT");
    }
  }
  if (!allowed && file.reportAttachment) {
    allowed = file.reportAttachment.report.userId === userId || await isAdminUser(userId);
  }

  if (!allowed) {
    console.warn("protected_file_denied", { fileId, userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await readPrivateFile(file.storageKey);
    const inline = ["IMAGE", "PDF", "VIDEO", "AUDIO"].includes(file.fileType);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.detectedMime,
        "Content-Length": String(bytes.length),
        "Content-Disposition": disposition(file.originalName, inline),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("protected_file_read_failed", { fileId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }
}
