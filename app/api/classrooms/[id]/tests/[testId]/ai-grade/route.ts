import { deepseek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId, prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import {
    AiDailyLimitError,
    aiLimitResponse,
    reserveAiAttempt,
    withAiUsage,
} from "@/lib/ai/usage";
import type { AiUsageState } from "@/lib/ai/usage-shared";
import {
    AI_GRADING_FEEDBACK_CHARACTER_LIMIT,
    AI_GRADING_MAX_ESSAYS_PER_ATTEMPT,
    AI_GRADING_QUESTION_CHARACTER_LIMIT,
    AI_GRADING_TOTAL_CONTEXT_CHARACTER_LIMIT,
    TEST_ESSAY_CHARACTER_LIMIT,
} from "@/lib/test-response-limits";

type RouteContext = { params: Promise<{ id: string; testId: string }> };
type Confidence = "HIGH" | "MEDIUM" | "LOW";

type EssayResponse = {
    id: string;
    responseText: string | null;
    pointsAwarded: number | null;
    aiSuggestedPoints: number | null;
    aiSuggestedFeedback: string | null;
    aiSuggestedConfidence: string | null;
    question: {
        questionText: string;
        questionType: string;
        points: number;
        answers: Array<{ answerText: string | null }>;
    };
};

const suggestionSchema = (count: number) => z.object({
    suggestions: z.array(z.object({
        responseId: z.string().min(1),
        suggestedScore: z.number().min(0),
        feedback: z.string().min(1).max(AI_GRADING_FEEDBACK_CHARACTER_LIMIT),
        confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    })).length(count),
});

function storedSuggestion(response: EssayResponse) {
    if (response.aiSuggestedPoints == null || !response.aiSuggestedFeedback) return null;
    const confidence: Confidence = response.aiSuggestedConfidence === "HIGH" || response.aiSuggestedConfidence === "MEDIUM"
        ? response.aiSuggestedConfidence
        : "LOW";
    return {
        responseId: response.id,
        suggestedScore: response.aiSuggestedPoints,
        feedback: response.aiSuggestedFeedback,
        confidence,
    };
}

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
            return NextResponse.json({ error: "Only teachers/TAs can request grading drafts" }, { status: 403 });
        }

        const body = await request.json() as { attemptId?: unknown };
        if (typeof body.attemptId !== "string" || !body.attemptId) {
            return NextResponse.json({ error: "Attempt ID required" }, { status: 400 });
        }

        const attempt = await prisma.testAttempt.findFirst({
            where: { id: body.attemptId, testId, isCompleted: true, test: { classroomId } },
            select: {
                id: true,
                test: { select: { title: true } },
                responses: {
                    include: { question: { include: { answers: { select: { answerText: true } } } } },
                },
            },
        });
        if (!attempt) return NextResponse.json({ error: "Completed attempt not found" }, { status: 404 });

        const essays = (attempt.responses as unknown as EssayResponse[]).filter((response) =>
            response.question.questionType === "ESSAY"
            && response.pointsAwarded == null
            && Boolean(response.responseText?.trim()),
        );
        if (essays.length === 0) return NextResponse.json({ suggestions: [], cached: true });

        const cachedSuggestions = essays.map(storedSuggestion).filter((suggestion) => suggestion !== null);
        const missing = essays.filter((response) => storedSuggestion(response) === null);
        if (missing.length === 0) {
            return NextResponse.json({ suggestions: cachedSuggestions, cached: true });
        }

        if (essays.length > AI_GRADING_MAX_ESSAYS_PER_ATTEMPT) {
            return NextResponse.json({
                error: `AI grading supports up to ${AI_GRADING_MAX_ESSAYS_PER_ATTEMPT} essays per attempt`,
                code: "TOO_MANY_ESSAYS",
                limit: AI_GRADING_MAX_ESSAYS_PER_ATTEMPT,
            }, { status: 413 });
        }
        const oversizedQuestion = missing.find((response) => response.question.questionText.length > AI_GRADING_QUESTION_CHARACTER_LIMIT);
        if (oversizedQuestion) {
            return NextResponse.json({
                error: `Essay questions must be ${AI_GRADING_QUESTION_CHARACTER_LIMIT.toLocaleString()} characters or fewer for AI grading`,
                code: "GRADING_QUESTION_TOO_LONG",
                limit: AI_GRADING_QUESTION_CHARACTER_LIMIT,
            }, { status: 413 });
        }
        const oversizedEssay = missing.find((response) => (response.responseText?.length ?? 0) > TEST_ESSAY_CHARACTER_LIMIT);
        if (oversizedEssay) {
            return NextResponse.json({
                error: `Essay responses must be ${TEST_ESSAY_CHARACTER_LIMIT.toLocaleString()} characters or fewer for AI grading`,
                code: "GRADING_RESPONSE_TOO_LONG",
                limit: TEST_ESSAY_CHARACTER_LIMIT,
            }, { status: 413 });
        }
        const contextLength = missing.reduce((total, response) => total
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
        const expectedIds = new Set(missing.map((response) => response.id));
        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            maxOutputTokens: Math.min(4_000, 400 + missing.length * 350),
            schema: suggestionSchema(missing.length),
            prompt: `Create review-only grading drafts for the essay responses below from "${attempt.test.title}".
Use only the supplied question, learner answer, expected answer when present, and point maximum.
Award a score between zero and the available points. Give concise, constructive feedback under ${AI_GRADING_FEEDBACK_CHARACTER_LIMIT} characters.
Use LOW confidence when the expected answer is absent or the answer is ambiguous. Return every response ID exactly once.

${missing.map((response) => `[ID: ${response.id}]
Question: ${response.question.questionText}
Points available: ${response.question.points}
Expected answer: ${response.question.answers.map((answer) => answer.answerText).filter(Boolean).join(" / ") || "Not supplied"}
Learner answer: ${response.responseText}`).join("\n\n")}`,
        });

        const generatedIds = new Set(object.suggestions.map((suggestion) => suggestion.responseId));
        if (generatedIds.size !== expectedIds.size || [...expectedIds].some((id) => !generatedIds.has(id))) {
            throw new Error("AI grading returned an incomplete response set");
        }

        const responseById = new Map(missing.map((response) => [response.id, response]));
        const generatedSuggestions = object.suggestions.map((suggestion) => {
            const response = responseById.get(suggestion.responseId);
            if (!response) throw new Error("AI grading returned an unknown response");
            return {
                responseId: response.id,
                suggestedScore: Math.min(response.question.points, Math.max(0, suggestion.suggestedScore)),
                feedback: suggestion.feedback.trim().slice(0, AI_GRADING_FEEDBACK_CHARACTER_LIMIT),
                confidence: suggestion.confidence,
            };
        });

        const suggestedAt = new Date();
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const suggestion of generatedSuggestions) {
                await tx.testAttemptResponse.update({
                    where: { id: suggestion.responseId },
                    data: {
                        aiSuggestedPoints: suggestion.suggestedScore,
                        aiSuggestedFeedback: suggestion.feedback,
                        aiSuggestedConfidence: suggestion.confidence,
                        aiSuggestedAt: suggestedAt,
                    },
                });
            }
        });

        return withAiUsage(NextResponse.json({
            suggestions: [...cachedSuggestions, ...generatedSuggestions],
            cached: false,
        }), usage);
    } catch (error) {
        if (error instanceof AiDailyLimitError) return aiLimitResponse(error);
        console.error("POST AI grading draft", error);
        return withAiUsage(NextResponse.json({ error: "AI grading drafts could not be generated" }, { status: 500 }), usage);
    }
}
