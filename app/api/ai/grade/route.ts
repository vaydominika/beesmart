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
                    select: { title: true }
                }
            }
        });

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
        }

        interface ResponseWithQuestion {
            id: string;
            responseText: string | null;
            question: {
                questionText: string;
                questionType: string;
                points: number;
            };
        }

        // Only process short answer and essay questions for AI suggestions
        const responsesToGrade = (attempt.responses as unknown as ResponseWithQuestion[]).filter((r) =>
            r.question.questionType === "SHORT_ANSWER" || r.question.questionType === "ESSAY"
        );

        if (responsesToGrade.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        const prompt = `You are an expert teaching assistant. Grade the following student responses for the test: "${attempt.test.title}".
Provide a suggested score (0 to points available) and a brief teacher comment/feedback for each.

Responses:
${responsesToGrade.map((r) => `
[ID: ${r.id}]
Question: ${r.question.questionText}
Points Available: ${r.question.points}
Student Answer: ${r.responseText}
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

        return NextResponse.json(object);

    } catch (e) {
        console.error("POST /api/ai/grade", e);
        return NextResponse.json({ error: "Server error during AI grading" }, { status: 500 });
    }
}
