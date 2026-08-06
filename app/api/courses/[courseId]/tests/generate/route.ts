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
        const body = await req.json();
        const { title, description, classroomId, difficulty = "Intermediate" } = body;
        const questionCount = Number.parseInt(String(body.questionCount ?? 5), 10);
        if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 20) {
            return NextResponse.json({ error: "Question count must be between 1 and 20" }, { status: 400 });
        }
        if (!["Beginner", "Intermediate", "Advanced"].includes(difficulty)) {
            return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
        }

        // Verify ownership/access
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                classroomLinks: { select: { classroomId: true } },
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

        if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
        const membership = classroomId ? await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId } },
            select: { role: true },
        }) : null;
        const linkedToClassroom = Boolean(classroomId) && (
            course.classroomId === classroomId || course.classroomLinks.some((link: { classroomId: string }) => link.classroomId === classroomId)
        );
        const canGenerate = course.createdById === userId || Boolean(membership && membership.role !== "STUDENT" && linkedToClassroom);
        if (!canGenerate) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

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
        return NextResponse.json({ test: object, courseId });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/tests/generate", e);
        return NextResponse.json({ error: "Server error during test generation" }, { status: 500 });
    }
}
