import { createHash } from "crypto";
import { deepseek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordMeaningfulActivity } from "@/lib/activity";
import {
    AiDailyLimitError,
    aiLimitResponse,
    reserveAiAttempt,
    withAiUsage,
} from "@/lib/ai/usage";
import type { AiUsageState } from "@/lib/ai/usage-shared";
import { getCurrentUserId, prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { notifyClassroomUser } from "@/lib/notifications";
import { calculateAttemptTotals } from "@/lib/test-scoring";
import {
    AI_GRADING_MAX_ESSAYS_PER_ATTEMPT,
    AI_GRADING_QUESTION_CHARACTER_LIMIT,
    AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT,
    TEST_ESSAY_CHARACTER_LIMIT,
} from "@/lib/test-response-limits";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

type EssayResponse = {
    id: string;
    questionId: string;
    responseText: string | null;
    pointsAwarded: number | null;
    question: {
        questionText: string;
        questionType: string;
        points: number;
        answers: Array<{ answerText: string | null }>;
    };
};

const gradeSchema = (count: number) => z.object({
    grades: z.array(z.object({
        responseId: z.string().min(1),
        pointsAwarded: z.number().min(0),
    })).length(count),
});

export async function POST(request: NextRequest, context: RouteContext) {
    let usage: AiUsageState | null = null;
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id: classroomId, testId } = await context.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId } },
            select: { role: true },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can use AI grading" }, { status: 403 });
        }

        const body = await request.json() as { attemptId?: unknown };
        if (typeof body.attemptId !== "string" || !body.attemptId) {
            return NextResponse.json({ error: "Attempt ID required" }, { status: 400 });
        }

        const attempt = await prisma.testAttempt.findFirst({
            where: { id: body.attemptId, testId, isCompleted: true, test: { classroomId } },
            select: {
                id: true,
                userId: true,
                score: true,
                test: {
                    select: {
                        title: true,
                        questions: { select: { id: true, points: true } },
                    },
                },
                responses: {
                    include: { question: { include: { answers: { select: { answerText: true } } } } },
                },
            },
        });
        if (!attempt) return NextResponse.json({ error: "Completed attempt not found" }, { status: 404 });

        const responses = attempt.responses as unknown as EssayResponse[];
        const essays = responses.filter((response) =>
            response.question.questionType === "ESSAY"
            && response.pointsAwarded == null
            && Boolean(response.responseText?.trim()),
        );
        if (essays.length === 0) {
            return NextResponse.json({ gradedCount: 0, score: attempt.score });
        }

        if (essays.length > AI_GRADING_MAX_ESSAYS_PER_ATTEMPT) {
            return NextResponse.json({
                error: `AI grading supports up to ${AI_GRADING_MAX_ESSAYS_PER_ATTEMPT} essays per attempt`,
                code: "TOO_MANY_ESSAYS",
                limit: AI_GRADING_MAX_ESSAYS_PER_ATTEMPT,
            }, { status: 413 });
        }
        const oversizedQuestion = essays.find((response) => response.question.questionText.length > AI_GRADING_QUESTION_CHARACTER_LIMIT);
        if (oversizedQuestion) {
            return NextResponse.json({
                error: `Essay questions must be ${AI_GRADING_QUESTION_CHARACTER_LIMIT.toLocaleString()} characters or fewer for AI grading`,
                code: "GRADING_QUESTION_TOO_LONG",
                limit: AI_GRADING_QUESTION_CHARACTER_LIMIT,
            }, { status: 413 });
        }
        const oversizedEssay = essays.find((response) => (response.responseText?.length ?? 0) > TEST_ESSAY_CHARACTER_LIMIT);
        if (oversizedEssay) {
            return NextResponse.json({
                error: `Essay responses must be ${TEST_ESSAY_CHARACTER_LIMIT.toLocaleString()} characters or fewer for AI grading`,
                code: "GRADING_RESPONSE_TOO_LONG",
                limit: TEST_ESSAY_CHARACTER_LIMIT,
            }, { status: 413 });
        }
        const contextLength = essays.reduce((total, response) => total
            + response.question.questionText.length
            + (response.responseText?.length ?? 0)
            + response.question.answers.reduce((answerTotal, answer) => answerTotal + (answer.answerText?.length ?? 0), 0), 0);
        if (contextLength > AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT) {
            return NextResponse.json({
                error: `AI grading context must total ${AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT.toLocaleString()} characters or fewer per attempt`,
                code: "GRADING_CONTEXT_TOO_LONG",
                limit: AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT,
            }, { status: 413 });
        }

        usage = await reserveAiAttempt(userId, "GRADING");
        const expectedIds = new Set(essays.map((response) => response.id));
        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            maxOutputTokens: Math.min(2_000, 200 + essays.length * 100),
            schema: gradeSchema(essays.length),
            prompt: `Grade the essay responses below from "${attempt.test.title}".
Return only each response ID and the awarded points. Do not return feedback, explanations, confidence, or an expected answer.
Use only the supplied question, learner answer, expected answer when present, and point maximum.
Award a numeric score between zero and the available points. Return every response ID exactly once.

${essays.map((response) => `[ID: ${response.id}]
Question: ${response.question.questionText}
Points available: ${response.question.points}
Expected answer: ${response.question.answers.map((answer) => answer.answerText).filter(Boolean).join(" / ") || "Not supplied"}
Learner answer: ${response.responseText}`).join("\n\n")}`,
        });

        const generatedIds = new Set(object.grades.map((grade) => grade.responseId));
        if (generatedIds.size !== expectedIds.size || [...expectedIds].some((id) => !generatedIds.has(id))) {
            throw new Error("AI grading returned an incomplete response set");
        }

        const responseById = new Map(essays.map((response) => [response.id, response]));
        const grades = object.grades.map((grade) => {
            const response = responseById.get(grade.responseId);
            if (!response) throw new Error("AI grading returned an unknown response");
            return {
                response,
                pointsAwarded: Math.min(response.question.points, Math.max(0, grade.pointsAwarded)),
            };
        });
        const awardedByResponseId = new Map(grades.map(({ response, pointsAwarded }) => [response.id, pointsAwarded]));
        const responsePoints = responses.map((response) => ({
            questionId: response.questionId,
            pointsAwarded: awardedByResponseId.get(response.id) ?? response.pointsAwarded ?? 0,
        }));
        const totals = calculateAttemptTotals(attempt.test.questions, responsePoints);

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const { response, pointsAwarded } of grades) {
                await tx.testAttemptResponse.update({
                    where: { id: response.id },
                    data: {
                        pointsAwarded,
                        isCorrect: pointsAwarded === response.question.points,
                    },
                });
            }
            await tx.testAttempt.update({
                where: { id: attempt.id },
                data: { score: totals.percentage },
            });
        });

        await notifyClassroomUser(attempt.userId, {
            classroomId,
            actorId: userId,
            title: "Assessment graded",
            body: `${attempt.test.title} was graded: ${Math.round(totals.percentage * 10) / 10}%`,
            type: "GRADE",
            relatedId: testId,
            relatedType: "test",
            actionUrl: `/classroom/${classroomId}/tests/${testId}`,
        });
        await recordMeaningfulActivity({
            userId,
            activityType: "GRADE_PROVIDED",
            classroomId,
            relatedId: attempt.id,
            dedupeKey: `test:ai-grade:${attempt.id}:${createHash("sha1").update(JSON.stringify(object.grades)).digest("hex")}`,
        });

        return withAiUsage(NextResponse.json({
            gradedCount: grades.length,
            score: totals.percentage,
            totalScore: totals.totalScore,
            totalPoints: totals.totalPoints,
        }), usage);
    } catch (error) {
        if (error instanceof AiDailyLimitError) return aiLimitResponse(error);
        console.error("POST AI grade", error);
        return withAiUsage(NextResponse.json({ error: "AI grading could not be completed" }, { status: 500 }), usage);
    }
}
