import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import { calculateAttemptTotals, scoreAutomaticResponse, type ScoringResponse } from "@/lib/test-scoring";
import type { Prisma } from "@/lib/generated/prisma";
import {
    TEST_RESPONSE_REQUEST_BYTE_LIMIT,
    TEST_TOTAL_WRITTEN_CHARACTER_LIMIT,
    totalWrittenCharacters,
    writtenResponseLimit,
} from "@/lib/test-response-limits";

type RouteContext = { params: Promise<{ id: string; testId: string }> };
type SubmittedResponse = { questionId: string; responseText?: string | null; selectedOptionId?: string | null };
type LoadedQuestion = {
    id: string;
    questionType: string;
    points: number;
    options: Array<{ id: string; isCorrect: boolean }>;
    answers: Array<{ answerText: string | null }>;
};
type StoredResponse = ScoringResponse & { id: string; responseText: string | null; selectedOptionId: string | null };

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id: classroomId, testId } = await context.params;
        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId } }, select: { role: true },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
        if (membership.role !== "STUDENT") return NextResponse.json({ error: "Only learners can submit attempts" }, { status: 403 });

        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (Number.isFinite(contentLength) && contentLength > TEST_RESPONSE_REQUEST_BYTE_LIMIT) {
            return NextResponse.json({ error: "The response payload is too large", code: "RESPONSE_PAYLOAD_TOO_LARGE" }, { status: 413 });
        }

        const body = await request.json() as { attemptId?: string; responses?: SubmittedResponse[] };
        const responses = body.responses ?? [];
        if (!body.attemptId || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Attempt ID and a response list are required" }, { status: 400 });
        }
        if (new Set(responses.map((response) => response.questionId)).size !== responses.length) {
            return NextResponse.json({ error: "Each question can only be submitted once" }, { status: 400 });
        }
        if (responses.some((response) => !response.questionId || (response.responseText != null && typeof response.responseText !== "string") || (response.selectedOptionId != null && typeof response.selectedOptionId !== "string"))) {
            return NextResponse.json({ error: "Invalid response payload" }, { status: 400 });
        }

        const attempt = await prisma.testAttempt.findFirst({
            where: { id: body.attemptId, testId, userId, isCompleted: false, test: { classroomId } },
            select: { id: true, startedAt: true },
        });
        if (!attempt) return NextResponse.json({ error: "Active attempt not found" }, { status: 404 });
        const test = await prisma.test.findFirst({
            where: { id: testId, classroomId },
            include: { questions: { orderBy: { order: "asc" }, include: { options: true, answers: true } } },
        });
        if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
        if (test.timeLimit) {
            const elapsedMinutes = (Date.now() - attempt.startedAt.getTime()) / 60_000;
            if (elapsedMinutes > test.timeLimit + 1) return NextResponse.json({ error: "Time limit exceeded" }, { status: 400 });
        }

        const questions = test.questions as LoadedQuestion[];
        const questionById = new Map(questions.map((question) => [question.id, question]));
        for (const response of responses) {
            const question = questionById.get(response.questionId);
            if (!question) return NextResponse.json({ error: "A response does not belong to this test" }, { status: 400 });
            const responseLimit = writtenResponseLimit(question.questionType);
            if (responseLimit !== null && (response.responseText?.length ?? 0) > responseLimit) {
                return NextResponse.json({
                    error: `${question.questionType === "ESSAY" ? "Essay" : "Short answer"} responses must be ${responseLimit.toLocaleString()} characters or fewer`,
                    code: "RESPONSE_TOO_LONG",
                    limit: responseLimit,
                }, { status: 413 });
            }
            if (response.selectedOptionId && !question.options.some((option) => option.id === response.selectedOptionId)) {
                return NextResponse.json({ error: "A selected option does not belong to its question" }, { status: 400 });
            }
        }
        if (totalWrittenCharacters(responses) > TEST_TOTAL_WRITTEN_CHARACTER_LIMIT) {
            return NextResponse.json({
                error: `Written responses for one attempt must total ${TEST_TOTAL_WRITTEN_CHARACTER_LIMIT.toLocaleString()} characters or fewer`,
                code: "ATTEMPT_TEXT_TOO_LONG",
                limit: TEST_TOTAL_WRITTEN_CHARACTER_LIMIT,
            }, { status: 413 });
        }

        const submittedAt = new Date();
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const response of responses) {
                await tx.testAttemptResponse.upsert({
                    where: { attemptId_questionId: { attemptId: attempt.id, questionId: response.questionId } },
                    update: {
                        responseText: response.responseText ?? null,
                        selectedOptionId: response.selectedOptionId ?? null,
                    },
                    create: { attemptId: attempt.id, questionId: response.questionId, responseText: response.responseText ?? null, selectedOptionId: response.selectedOptionId ?? null },
                });
            }

            const storedResponses = await tx.testAttemptResponse.findMany({ where: { attemptId: attempt.id } }) as StoredResponse[];
            const storedByQuestion = new Map(storedResponses.map((response) => [response.questionId, response]));
            const scoredResponses: ScoringResponse[] = [];
            let needsManualGrading = false;

            for (const question of questions) {
                const stored = storedByQuestion.get(question.id);
                const scoring = scoreAutomaticResponse(question, stored);
                needsManualGrading ||= scoring.needsManualGrading;
                const saved = await tx.testAttemptResponse.upsert({
                    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
                    update: { isCorrect: scoring.isCorrect, pointsAwarded: scoring.pointsAwarded },
                    create: {
                        attemptId: attempt.id,
                        questionId: question.id,
                        responseText: null,
                        selectedOptionId: null,
                        isCorrect: scoring.isCorrect,
                        pointsAwarded: scoring.pointsAwarded,
                    },
                });
                scoredResponses.push(saved);
            }

            const totals = calculateAttemptTotals(questions, scoredResponses);
            const updatedAttempt = await tx.testAttempt.update({
                where: { id: attempt.id },
                data: {
                    isCompleted: true,
                    submittedAt,
                    score: needsManualGrading ? null : totals.percentage,
                },
            });
            return { attempt: updatedAttempt, ...totals, needsManualGrading };
        });

        await recordMeaningfulActivity({
            userId, activityType: "TEST_COMPLETED", classroomId, relatedId: attempt.id,
            dedupeKey: `test:complete:${attempt.id}`,
        });
        return NextResponse.json(result);
    } catch (error) {
        console.error("POST submit test", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
