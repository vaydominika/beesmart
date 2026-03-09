import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

type RouteContext = { params: Promise<{ courseId: string; lessonId: string }> };

export const maxDuration = 60; // Allow up to 60 seconds for generation

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, lessonId } = await ctx.params;

        // Verify ownership
        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course || course.createdById !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const data = await req.json();
        const { prompt, tone, existingContent } = data; // the user can specify what they want to generate, e.g. "Expand on this topic" or a specific system prompt

        const lesson = await prisma.courseLesson.findUnique({
            where: { id: lessonId },
            include: { module: { select: { title: true } } }
        });

        if (!lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        let systemPrompt = `You are an expert teacher and curriculum writer. 
You are writing a course lesson. 
Module Name: "${lesson.module.title}"
Lesson Request: "${prompt || lesson.title}"
${tone ? `Tone: ${tone}` : ''}
Your goal is to write engaging, high-quality educational content formatted in clean, semantic HTML or Markdown that can be easily dropped into a TipTap rich text editor. Do NOT wrap the answer in a markdown code block. Just output the raw formatted text. Use bolding, lists, and headings appropriately.`;

        if (existingContent) {
            systemPrompt += `\n\nHere is the existing content for context:\n${existingContent}`;
        }

        const result = await streamText({
            model: anthropic("claude-3-5-sonnet-latest"),
            system: systemPrompt,
            messages: [{ role: "user", content: `Please generate the lesson content for: ${lesson.title}` }],
        });

        // Use AI SDK's built-in Route Handler response
        return result.toTextStreamResponse();

    } catch (e) {
        console.error("POST /api/courses/[courseId]/lessons/[lessonId]/generate", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
