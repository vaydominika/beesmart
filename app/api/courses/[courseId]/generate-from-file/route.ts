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

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course || course.createdById !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        const prompt = `You are an expert curriculum designer. Extract the key subjects, knowledge, and structure from the attached document/image and create a comprehensive course outline.
The outline should be broken down into logically sequenced modules, and each module should contain lessons. Return a strict JSON structure.`;

        const { object } = await generateObject({
            model: anthropic("claude-3-5-sonnet-latest"),
            schema: z.object({
                modules: z.array(z.object({
                    title: z.string().describe("The name of the module/chapter"),
                    description: z.string().describe("Short description of what the module covers"),
                    lessons: z.array(z.object({
                        title: z.string().describe("The name of the specific lesson"),
                        description: z.string().describe("What the lesson specifically teaches based on the document"),
                    })).min(1),
                })).min(1),
            }),
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'file',
                            data: uint8Array,
                            mediaType: file.type,
                        },
                    ],
                },
            ],
        });

        return NextResponse.json({ outline: object });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/generate-from-file", e);
        return NextResponse.json({ error: "Server error or unsupported file type" }, { status: 500 });
    }
}
