import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { generateObject } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { canManageCourse } from "@/lib/course-access";
import { courseAuditSchema } from "@/lib/course-audit";

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
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
            const lessonsText = m.lessons.map((l) => `[LESSON ID: ${l.id}; TITLE: ${l.title}]\n${l.content || "No content"}`).join("\n\n");
            return `### MODULE: ${m.title}\n${m.description || ""}\n\n${lessonsText}`;
        }).join("\n\n---\n\n");

        if (fullCourseText.trim().length === 0) {
            return NextResponse.json({ error: "Course has no content to audit." }, { status: 400 });
        }

        // 3. Perform the AI Audit using DeepSeek
        const { object } = await generateObject({
            model: deepseek("deepseek-chat"),
            schema: courseAuditSchema,
            system: "You are a senior educational auditor for beesmart. Perform a deep pedagogical and safety audit on the supplied course material. Be critical but constructive. Ensure the content is safe, logically structured, and high-quality for learners. For lesson-specific findings, copy the exact lesson ID supplied in the content. Use null for course-wide or module-wide findings.",
            prompt: `Auditor Report for Course: "${course.title}"\n\nContent:\n${fullCourseText.substring(0, 30000)}`, // Limit context to avoid token overflow
        });

        // 4. Return the audit results
        return NextResponse.json({ audit: object });

    } catch (e) {
        console.error("POST /api/courses/[courseId]/audit", e);
        return NextResponse.json({ error: "Server error during course audit" }, { status: 500 });
    }
}
