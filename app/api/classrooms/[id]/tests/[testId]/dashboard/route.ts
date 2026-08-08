import { NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string }> };
type DashboardResponse = { pointsAwarded: number | null; question: { questionType: string } } & Record<string, unknown>;
type DashboardAttempt = { id: string; userId: string; attemptNumber: number; isCompleted: boolean; responses: DashboardResponse[] } & Record<string, unknown>;
type StudentMembership = { userId: string; user: { id: string; name: string } };

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
                orderBy: { startedAt: "desc" },
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
    const dashboardTest = test as unknown as { attempts: DashboardAttempt[] } & Record<string, unknown>;
    const studentMemberships = students as unknown as StudentMembership[];
    const attemptedIds = new Set(dashboardTest.attempts.map((attempt) => attempt.userId));
    const { attempts, ...testDetails } = dashboardTest;
    const decorateAttempt = (attempt: DashboardAttempt) => {
        const manualResponses = attempt.responses.filter((response) => response.question.questionType === "ESSAY");
        const manualResponsesRemaining = manualResponses.filter((response) => response.pointsAwarded == null).length;
        return {
            ...attempt,
            manualResponsesRemaining,
            gradingStatus: !attempt.isCompleted
                ? "IN_PROGRESS"
                : manualResponsesRemaining > 0
                    ? "NEEDS_REVIEW"
                    : "GRADED",
        };
    };
    return NextResponse.json({
        test: testDetails,
        dashboard: {
            completed: attempts.filter((attempt) => attempt.isCompleted).map(decorateAttempt),
            inProgress: attempts.filter((attempt) => !attempt.isCompleted).map(decorateAttempt),
            notStarted: studentMemberships.filter((student) => !attemptedIds.has(student.userId)).map((student) => ({ user: student.user })),
        },
    });
}
