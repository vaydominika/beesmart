import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import { streamText } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { checkContentSafety, flagContent } from "@/lib/ai/moderation";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { content, type, goal, context } = await req.json();

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

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

        const result = await streamText({
            model: deepseek("deepseek-chat"),
            system: systemPrompt,
            messages: [{ role: "user", content: `Please improve this content:\n\n${content}` }],
        });

        return result.toTextStreamResponse();

    } catch (e) {
        console.error("POST /api/improve", e);
        return NextResponse.json({ error: "Server error during improvement" }, { status: 500 });
    }
}
