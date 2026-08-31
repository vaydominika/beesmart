import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { storedFileUrl } from "@/lib/files/types";
import { parseAssignmentDeadline, DeadlineValidationError } from "@/lib/assignment-deadline";
import { assertDeadlineNotPast, ScheduleValidationError } from "@/lib/schedule-validation";
import { sanitizeRichTextHtml } from "@/lib/security/rich-text";
import { syncAssignmentCalendarEvent } from "@/lib/classroom-assignment-sync";
import { notifyClassroomMembers } from "@/lib/notifications";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId, assignmentId } = await context.params;
  const membership = await prisma.classroomMember.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { role: true },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const assignment = await prisma.assignedWork.findFirst({
    where: {
      id: assignmentId,
      classroomId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      deadlineAt: true,
      deadlineTimeZone: true,
      deadlineHasTime: true,
      isGraded: true,
      maxPoints: true,
      createdAt: true,
      assigner: { select: { id: true, name: true, avatar: true } },
      posts: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { files: true },
      },
    },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const { posts, ...details } = assignment;
  return NextResponse.json({
    ...details,
    files: (posts[0]?.files ?? []).map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })),
    viewerRole: membership.role,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId, assignmentId } = await context.params;
  const membership = await prisma.classroomMember.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { role: true },
  });
  if (!membership || membership.role === "STUDENT") {
    return NextResponse.json({ error: "Only teachers/TAs can update assignments" }, { status: 403 });
  }

  const existing = await prisma.assignedWork.findFirst({ where: { id: assignmentId, classroomId } });
  if (!existing) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const body = await request.json();
  const title = body.title === undefined ? existing.title : String(body.title).trim();
  const description = body.description === undefined ? existing.description : String(body.description ?? "").trim() || null;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  let deadline = {
    deadlineAt: existing.deadlineAt,
    deadlineTimeZone: existing.deadlineTimeZone,
    deadlineHasTime: existing.deadlineHasTime,
  };
  try {
    if (body.dueDate !== undefined || body.dueTime !== undefined || body.timeZone !== undefined) {
      deadline = parseAssignmentDeadline({
        dueDate: body.dueDate,
        dueTime: body.dueTime,
        timeZone: body.timeZone,
      });
      if (Math.floor(deadline.deadlineAt.getTime() / 60_000) !== Math.floor(existing.deadlineAt.getTime() / 60_000)) {
        assertDeadlineNotPast(deadline.deadlineAt, "Assignment deadline");
      }
    }
  } catch (error) {
    if (error instanceof DeadlineValidationError || error instanceof ScheduleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const isGraded = body.isGraded === undefined ? existing.isGraded : Boolean(body.isGraded);
  let maxPoints = existing.maxPoints;
  if (!isGraded) maxPoints = null;
  else if (body.maxPoints !== undefined) {
    const parsedPoints = Number(body.maxPoints);
    if (!Number.isFinite(parsedPoints) || parsedPoints < 0) {
      return NextResponse.json({ error: "Maximum points must be zero or greater" }, { status: 400 });
    }
    maxPoints = parsedPoints;
  }
  if (isGraded && maxPoints == null) {
    return NextResponse.json({ error: "Maximum points are required for graded assignments" }, { status: 400 });
  }

  const assignmentChanged = title !== existing.title
    || description !== existing.description
    || deadline.deadlineAt.getTime() !== existing.deadlineAt.getTime()
    || deadline.deadlineTimeZone !== existing.deadlineTimeZone
    || deadline.deadlineHasTime !== existing.deadlineHasTime
    || isGraded !== existing.isGraded
    || Number(maxPoints ?? 0) !== Number(existing.maxPoints ?? 0);

  const updated = await prisma.$transaction(async (transaction) => {
    const assignment = await transaction.assignedWork.update({
      where: { id: assignmentId },
      data: { title, description, ...deadline, isGraded, maxPoints },
    });
    await transaction.classroomPost.updateMany({
      where: { assignmentId },
      data: {
        title: null,
        content: description ? sanitizeRichTextHtml(description) : null,
        ...(assignmentChanged ? { editedAt: new Date() } : {}),
      },
    });
    if (existing.isGraded && !isGraded) {
      await transaction.grade.deleteMany({ where: { assignedWorkId: assignmentId } });
      await transaction.submission.updateMany({
        where: { assignedWorkId: assignmentId, status: "GRADED", submittedAt: { gt: existing.deadlineAt } },
        data: { status: "LATE" },
      });
      await transaction.submission.updateMany({
        where: {
          assignedWorkId: assignmentId,
          status: "GRADED",
          OR: [{ submittedAt: null }, { submittedAt: { lte: existing.deadlineAt } }],
        },
        data: { status: "SUBMITTED" },
      });
    }
    return assignment;
  });

  await syncAssignmentCalendarEvent(assignmentId);
  if (assignmentChanged) {
    await notifyClassroomMembers({
      classroomId,
      actorId: userId,
      title: "Assignment updated",
      body: `${updated.title} was changed or rescheduled.`,
      type: "ASSIGNMENT",
      relatedId: assignmentId,
      relatedType: "assignment",
      actionUrl: `/classroom/${classroomId}/assignments/${assignmentId}`,
      recipientRoles: ["STUDENT"],
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId, assignmentId } = await context.params;
  const membership = await prisma.classroomMember.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { role: true },
  });
  if (!membership || membership.role === "STUDENT") {
    return NextResponse.json({ error: "Only teachers/TAs can delete assignments" }, { status: 403 });
  }

  const assignment = await prisma.assignedWork.findFirst({
    where: { id: assignmentId, classroomId },
    select: { id: true, title: true },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  await notifyClassroomMembers({
    classroomId,
    actorId: userId,
    title: "Assignment removed",
    body: `${assignment.title} was removed from the Classroom.`,
    type: "ASSIGNMENT",
    relatedType: "classroom",
    actionUrl: `/classroom/${classroomId}`,
    recipientRoles: ["STUDENT"],
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.classroomPost.deleteMany({ where: { assignmentId } });
    await transaction.assignedWork.delete({ where: { id: assignmentId } });
  });

  return NextResponse.json({ success: true });
}
