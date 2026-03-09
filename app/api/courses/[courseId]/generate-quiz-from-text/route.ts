import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        // Verify ownership
        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course || course.createdById !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { textEntry } = await req.json();

        if (!textEntry || typeof textEntry !== "string") {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        const prompt = `You are an expert teacher. Read the following lesson text and generate exactly ONE "Check for Understanding" question based on the key concepts in this text.
The question can be multiple choice, true/false, or a short answer.

Lesson Text:
"${textEntry}"`;

        const { object } = await generateObject({
            model: anthropic("claude-3-5-sonnet-latest"),
            schema: z.object({
                type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const).describe("The type of question"),
                question: z.string().describe("The question text"),
                options: z.array(z.string()).optional().describe("The options, if multiple choice. Maximum 4 options. Include the correct answer."),
                correctAnswer: z.string().describe("The correct answer (exact string match for options or true/false)"),
                explanation: z.string().describe("Why is this the correct answer? Shown to student after they guess."),
            }),
            prompt,
        });

        return NextResponse.json(object);

    } catch (e) {
        console.error("POST /api/courses/[courseId]/generate-quiz-from-text", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
