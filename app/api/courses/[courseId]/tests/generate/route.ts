import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { checkContentSafety, flagContent } from "@/lib/ai/moderation";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        // Verify ownership/access
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                modules: {
                    include: {
                        lessons: {
                            select: {
                                title: true,
                                content: true,
                            }
                        }
                    }
                }
            }
        });

        if (!course || course.createdById !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { title, description, questionCount = 5, difficulty = "Intermediate" } = body;

        interface TestLesson {
            title: string;
            content: string | null;
        }

        interface TestModule {
            lessons: TestLesson[];
        }

        // Collect all lesson content for context
        const allContent = (course.modules as unknown as TestModule[]).flatMap((m) => m.lessons.map((l) => `${l.title}: ${l.content}`)).join("\n\n");

        if (!allContent) {
            return NextResponse.json({ error: "Course has no content to generate a test from." }, { status: 400 });
        }

        const prompt = `You are an expert educator. Based on the following course content, generate a comprehensive test with ${questionCount} questions.
The test should have a title: "${title || course.title + ' Quiz'}" and description: "${description || 'A test to check your understanding of ' + course.title}".
Difficulty Level: ${difficulty}

Course Content:
${allContent.substring(0, 15000)} // Truncate context to avoid token limits

Return a JSON structure suitable for the Test model. Each question should have options (if multiple choice) or a correct answer.`;

        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                title: z.string(),
                description: z.string(),
                questions: z.array(z.object({
                    text: z.string().describe("The question text"),
                    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"]),
                    points: z.number().default(1),
                    options: z.array(z.object({
                        text: z.string(),
                        isCorrect: z.boolean(),
                    })).optional().describe("Only for MULTIPLE_CHOICE"),
                    correctAnswer: z.string().optional().describe("For TRUE_FALSE or SHORT_ANSWER"),
                })).min(1),
            }),
            prompt,
        });

        // Safety check on generated test
        const safetyResult = await checkContentSafety(JSON.stringify(object));
        if (!safetyResult.safe) {
            await flagContent(userId, courseId, "AI_TEST_GENERATION_UNSAFE", safetyResult.reason);
            return NextResponse.json({ error: "The generated test contained inappropriate content. Try adjusting the scope." }, { status: 400 });
        }

        // Return the generated test for preview
        return NextResponse.json({ test: object });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/tests/generate", e);
        return NextResponse.json({ error: "Server error during test generation" }, { status: 500 });
    }
}
