import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { courseId } = await req.json();

        if (!courseId) {
            return NextResponse.json({ error: "Course ID required" }, { status: 400 });
        }

        // 1. Fetch student's past mistakes in this course
        const pastAttempts = await prisma.testAttempt.findMany({
            where: {
                userId,
                test: { courseId }
            },
            include: {
                responses: {
                    where: { isCorrect: false },
                    include: { question: true }
                }
            }
        });

        interface PracticeResponse {
            responseText: string | null;
            question: {
                questionText: string;
            };
        }

        interface PracticeAttempt {
            responses: PracticeResponse[];
        }

        const mistakes = (pastAttempts as unknown as PracticeAttempt[]).flatMap((a) => a.responses.map((r) => ({
            question: r.question.questionText,
            theirAnswer: r.responseText,
        })));

        // 2. Fetch course context for broader coverage
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { title: true }
        });

        const prompt = `You are a personalized tutor. The student is studying the course: "${course?.title}".
Below is a list of questions they recently got WRONG in this course. 
Analyze their mistakes and generate 5 NEW practice questions that help them reinforce those specific concepts.

Past Mistakes:
${mistakes.map((m) => `Q: ${m.question}\nA: ${m.theirAnswer}`).join("\n\n")}

Return the questions in a JSON format suitable for a quick practice session.`;

        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                practiceTitle: z.string(),
                questions: z.array(z.object({
                    text: z.string(),
                    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
                    options: z.array(z.string()).optional(),
                    correctAnswer: z.string(),
                    explanation: z.string().describe("Explain why this is the correct answer and how it relates to their past mistake")
                }))
            }),
            prompt,
        });

        return NextResponse.json(object);

    } catch (e) {
        console.error("POST /api/ai/practice", e);
        return NextResponse.json({ error: "Server error during practice generation" }, { status: 500 });
    }
}
