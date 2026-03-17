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

        const { textEntry } = await req.json();

        if (!textEntry || typeof textEntry !== "string") {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        const prompt = `You are an AI glossary assistant. Read the following text snippet from a course lesson. Extract the most difficult or important concept/term, and provide a short, simple, easy-to-understand definition for a student.

Text:
"${textEntry}"`;

        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                term: z.string().describe("The key term or concept found in the text"),
                definition: z.string().describe("A simple, 1-3 sentence explanation or definition"),
                example: z.string().optional().describe("A quick example of the concept, if applicable"),
            }),
            prompt,
        });

        return NextResponse.json(object);

    } catch (e) {
        console.error("POST /api/courses/[courseId]/generate-glossary", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
