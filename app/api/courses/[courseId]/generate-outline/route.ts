import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
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

        const { topic, description, targetAudience } = await req.json();

        if (!topic) {
            return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        const prompt = `You are an expert curriculum designer. 
Create a comprehensive course outline for the topic: "${topic}".
${description ? `Additional context: ${description}` : ''}
${targetAudience ? `Target audience: ${targetAudience}` : ''}

The course should be broken down into logically sequenced modules, and each module should contain 3-6 lessons. Returns a strict JSON structure.`;

        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                modules: z.array(z.object({
                    title: z.string().describe("The name of the module/chapter"),
                    description: z.string().describe("Short description of what the module covers"),
                    lessons: z.array(z.object({
                        title: z.string().describe("The name of the specific lesson"),
                        description: z.string().describe("What the lesson specifically teaches"),
                    })).min(1),
                })).min(1),
            }),
            prompt,
        });

        // Safety check on generated content
        const { checkContentSafety, flagContent } = await import("@/lib/ai/moderation");
        const fullContentText = JSON.stringify(object);
        const safetyResult = await checkContentSafety(fullContentText);

        if (!safetyResult.safe) {
            await flagContent(userId, courseId, "AI_GENERATED_UNSAFE", safetyResult.reason);
            return NextResponse.json({ error: "Generated content was flagged as inappropriate. Please try a different topic." }, { status: 400 });
        }

        // The user wants to *preview* the outline before we save it to the DB!
        // So we just return the generated outline here. The frontend will present it,
        // let the user freely edit the module/lesson titles, and then the frontend
        // will POST the final approved structure to a different endpoint (like /api/courses/[id]/modules/bulk) to actually save it.

        return NextResponse.json({ outline: object });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/generate-outline", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
