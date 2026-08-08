import { NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

function learnerTestPayload(test: any, attempt: any) {
    return {
        attempt: {
            id: attempt.id,
            userId: attempt.userId,
            attemptNumber: attempt.attemptNumber,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            isCompleted: attempt.isCompleted,
            score: attempt.score,
        },
        responses: attempt.responses.map((response: any) => ({
            questionId: response.questionId,
            responseText: response.responseText,
            selectedOptionId: response.selectedOptionId,
        })),
        test: {
            id: test.id,
            title: test.title,
            description: test.description,
            type: test.type,
            timeLimit: test.timeLimit,
            passingScore: test.passingScore,
            maxAttempts: test.maxAttempts,
            questions: test.questions.map((question: any) => ({
                id: question.id,
                questionText: question.questionText,
                questionType: question.questionType,
                points: question.points,
                options: question.options.map((option: any) => ({ id: option.id, optionText: option.optionText })),
            })),
        },
    };
}

export async function POST(_request: Request, context: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id: classroomId, testId } = await context.params;

    const membership = await prisma.classroomMember.findUnique({
        where: { userId_classroomId: { userId, classroomId } },
        select: { role: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    if (membership.role !== "STUDENT") return NextResponse.json({ error: "Only learners can start attempts" }, { status: 403 });

    const test = await prisma.test.findFirst({
        where: { id: testId, classroomId },
        include: {
            questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
        },
    });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    const now = new Date();
    if (test.opensAt && now < test.opensAt) return NextResponse.json({ error: "Test is not open yet" }, { status: 400 });
    if (test.closesAt && now > test.closesAt) return NextResponse.json({ error: "Test is closed" }, { status: 400 });

    const includeResponses = { responses: { orderBy: { createdAt: "asc" as const } } };
    const activeAttempt = await prisma.testAttempt.findFirst({
        where: { testId, userId, isCompleted: false },
        include: includeResponses,
        orderBy: { attemptNumber: "desc" },
    });
    if (activeAttempt) return NextResponse.json(learnerTestPayload(test, activeAttempt));

    const completedCount = await prisma.testAttempt.count({ where: { testId, userId, isCompleted: true } });
    if (completedCount >= test.maxAttempts) {
        return NextResponse.json({ error: "No attempts remaining", code: "ATTEMPT_LIMIT_REACHED" }, { status: 409 });
    }

    try {
        const attempt = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const existing = await tx.testAttempt.findFirst({
                where: { testId, userId, isCompleted: false },
                include: includeResponses,
            });
            if (existing) return existing;
            const aggregate = await tx.testAttempt.aggregate({ where: { testId, userId }, _max: { attemptNumber: true } });
            const submitted = await tx.testAttempt.count({ where: { testId, userId, isCompleted: true } });
            if (submitted >= test.maxAttempts) throw new Error("ATTEMPT_LIMIT_REACHED");
            return tx.testAttempt.create({
                data: { testId, userId, attemptNumber: (aggregate._max.attemptNumber ?? 0) + 1 },
                include: includeResponses,
            });
        });
        return NextResponse.json(learnerTestPayload(test, attempt), { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "ATTEMPT_LIMIT_REACHED") {
            return NextResponse.json({ error: "No attempts remaining", code: error.message }, { status: 409 });
        }
        if ((error as { code?: string }).code === "P2002") {
            const winningAttempt = await prisma.testAttempt.findFirst({
                where: { testId, userId, isCompleted: false }, include: includeResponses,
            });
            if (winningAttempt) return NextResponse.json(learnerTestPayload(test, winningAttempt));
        }
        console.error("POST start test", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
