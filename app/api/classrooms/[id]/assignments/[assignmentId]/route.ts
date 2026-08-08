import { NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";

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
    where: { id: assignmentId, classroomId },
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
    files: posts[0]?.files ?? [],
    viewerRole: membership.role,
  });
}
