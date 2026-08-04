import { NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, testId } = await ctx.params;
    const membership = await prisma.classroomMember.findUnique({ where: { userId_classroomId: { userId, classroomId: id } } });
    if (!membership || membership.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const test = await prisma.test.findFirst({
        where: { id: testId, classroomId: id },
        include: {
            questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } }, answers: true } },
            attempts: {
                include: {
                    user: { select: { id: true, name: true, email: true, avatar: true } },
                    responses: { include: { question: { include: { options: true, answers: true } } } },
                },
            },
        },
    });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    const students = await prisma.classroomMember.findMany({
        where: { classroomId: id, role: "STUDENT" },
        include: { user: { select: { id: true, name: true } } },
    });
    const attemptedIds = new Set(test.attempts.map((attempt: any) => attempt.userId));
    const { attempts, ...testDetails } = test;
    return NextResponse.json({
        test: testDetails,
        dashboard: {
            completed: attempts.filter((attempt: any) => attempt.isCompleted),
            inProgress: attempts.filter((attempt: any) => !attempt.isCompleted),
            notStarted: students.filter((student: any) => !attemptedIds.has(student.userId)).map((student: any) => ({ user: student.user })),
        },
    });
}
