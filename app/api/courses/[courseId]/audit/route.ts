import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";

type RouteContext = { params: Promise<{ courseId: string }> };

export const maxDuration = 120; // Deep scan might take time

export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        // 1. Fetch the entire course structure and content
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                modules: {
                    orderBy: { order: 'asc' },
                    include: {
                        lessons: {
                            orderBy: { order: 'asc' },
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                content: true,
                            }
                        }
                    }
                }
            }
        });

        if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

        // Check ownership (only teachers can audit their own courses)
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        interface AuditLesson {
            id: string;
            title: string;
            description: string | null;
            content: string | null;
        }

        interface AuditModule {
            title: string;
            description: string | null;
            lessons: AuditLesson[];
        }

        // 2. Prepare the payload for AI audit
        const fullCourseText = (course.modules as unknown as AuditModule[]).map((m) => {
            const lessonsText = m.lessons.map((l) => `[LESSON: ${l.title}]\n${l.content || "No content"}`).join("\n\n");
            return `### MODULE: ${m.title}\n${m.description || ""}\n\n${lessonsText}`;
        }).join("\n\n---\n\n");

        if (fullCourseText.trim().length === 0) {
            return NextResponse.json({ error: "Course has no content to audit." }, { status: 400 });
        }

        // 3. Perform the AI Audit using DeepSeek
        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: z.object({
                overallScore: z.number().min(0).max(100).describe("Overall pedagogical quality score"),
                summary: z.string().describe("Executive summary of the course audit"),
                strengths: z.array(z.string()).describe("List of positive aspects found in the course"),
                qualityIssues: z.array(z.object({
                    lessonId: z.string().optional(),
                    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
                    issue: z.string(),
                    suggestion: z.string(),
                })).describe("Potential pedagogical or structural improvements"),
                safetyFlags: z.array(z.object({
                    lessonId: z.string().optional(),
                    contentSnippet: z.string(),
                    reason: z.string(),
                })).describe("Any potential violations of the safety policy"),
                accessibilityScore: z.number().min(0).max(100).describe("Estimate of content accessibility (structure, clarity)"),
            }),
            system: "You are a senior educational auditor for beesmart. Your task is to perform a deep pedagogical and safety audit on the provided course material. Be critical but constructive. Ensure the content is safe, logically structured, and high-quality for students.",
            prompt: `Auditor Report for Course: "${course.title}"\n\nContent:\n${fullCourseText.substring(0, 30000)}`, // Limit context to avoid token overflow
        });

        // 4. Return the audit results
        return NextResponse.json({ audit: object });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/audit", e);
        return NextResponse.json({ error: "Server error during course audit" }, { status: 500 });
    }
}
