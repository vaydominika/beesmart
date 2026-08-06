import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { generateText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { checkContentSafety, flagContent } from "@/lib/ai/moderation";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { content, type, goal, context, courseId, lessonId } = await req.json();

        if (!courseId || !lessonId || typeof content !== "string" || !content.trim()) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        if (content.length > 30000 || (typeof goal === "string" && goal.length > 500)) {
            return NextResponse.json({ error: "The requested revision is too long" }, { status: 400 });
        }
        const lesson = await prisma.courseLesson.findFirst({
            where: { id: lessonId, module: { courseId, course: { createdById: userId } } },
            select: { id: true },
        });
        if (!lesson) return NextResponse.json({ error: "Lesson not found or forbidden" }, { status: 403 });

        // Safety check on input
        const inputSafety = await checkContentSafety(`Content: ${content}\nGoal: ${goal || "Improve"}`);
        if (!inputSafety.safe) {
            // Flagging this as potential abuse/misuse
            await flagContent(userId, "N/A", "AI_IMPROVE_INPUT_UNSAFE", inputSafety.reason);
            return NextResponse.json({ error: "Inappropriate content detected." }, { status: 400 });
        }

        const systemPrompt = `You are an expert editor and educational consultant. 
Your goal is to improve the provided ${type || 'content'} based on the user's goal: "${goal || 'Make it better'}".
${context ? `Context about the course/lesson: ${context}` : ''}

Maintain a professional, educational tone. Your response should be ONLY the improved content, formatted correctly (Markdown or HTML as appropriate for the type). do NOT wrap it in a code block.`;

        const result = await generateText({
            model: deepseek("deepseek-chat"),
            system: systemPrompt,
            messages: [{ role: "user", content: `Please improve this content:\n\n${content}` }],
        });

        const outputSafety = await checkContentSafety(result.text);
        if (!outputSafety.safe) {
            await flagContent(userId, courseId, "AI_IMPROVE_OUTPUT_UNSAFE", outputSafety.reason);
            return NextResponse.json({ error: "The proposed revision was flagged as inappropriate." }, { status: 400 });
        }

        return new Response(result.text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

    } catch (e) {
        console.error("POST /api/improve", e);
        return NextResponse.json({ error: "Server error during improvement" }, { status: 500 });
    }
}
