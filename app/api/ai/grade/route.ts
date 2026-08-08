import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { attemptId } = await req.json();

        if (!attemptId) {
            return NextResponse.json({ error: "Attempt ID required" }, { status: 400 });
        }

        const attempt = await prisma.testAttempt.findUnique({
            where: { id: attemptId },
            include: {
                responses: {
                    include: { question: true }
                },
                test: {
                    select: { title: true, classroomId: true }
                }
            }
        });

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
        }
        if (!attempt.isCompleted || !attempt.test.classroomId) {
            return NextResponse.json({ error: "Only completed classroom attempts can be reviewed" }, { status: 400 });
        }
        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: attempt.test.classroomId } },
            select: { role: true },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can request grading suggestions" }, { status: 403 });
        }

        interface ResponseWithQuestion {
            id: string;
            responseText: string | null;
            pointsAwarded: number | null;
            question: {
                questionText: string;
                questionType: string;
                points: number;
            };
        }

        // Normalized short answers are automatic; AI only reviews answered essays still awaiting a teacher.
        const responsesToGrade = (attempt.responses as unknown as ResponseWithQuestion[]).filter((r) =>
            r.question.questionType === "ESSAY" && r.pointsAwarded == null && Boolean(r.responseText?.trim())
        );

        if (responsesToGrade.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        const prompt = `You are an expert teaching assistant. Grade the following learner responses for the test: "${attempt.test.title}".
Provide a suggested score (0 to points available) and a brief teacher comment/feedback for each.

Responses:
${responsesToGrade.map((r) => `
[ID: ${r.id}]
Question: ${r.question.questionText}
Points Available: ${r.question.points}
Learner answer: ${r.responseText}
`).join("\n")}

Return a JSON array of suggestions.`;

        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                suggestions: z.array(z.object({
                    responseId: z.string(),
                    suggestedScore: z.number(),
                    feedback: z.string(),
                    isCorrect: z.boolean(),
                }))
            }),
            prompt,
        });

        const maxByResponse = new Map(responsesToGrade.map((response) => [response.id, response.question.points]));
        return NextResponse.json({
            suggestions: object.suggestions
                .filter((suggestion) => maxByResponse.has(suggestion.responseId))
                .map((suggestion) => {
                    const max = maxByResponse.get(suggestion.responseId) ?? 0;
                    const suggestedScore = Math.min(max, Math.max(0, suggestion.suggestedScore));
                    return { ...suggestion, suggestedScore, isCorrect: suggestedScore === max };
                }),
        });

    } catch (e) {
        console.error("POST /api/ai/grade", e);
        return NextResponse.json({ error: "Server error during AI grading" }, { status: 500 });
    }
}
