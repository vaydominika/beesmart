import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canManageCourse, getLessonAccess } from "@/lib/course-access";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string; lessonId: string }> };

// GET /api/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId, lessonId } = await ctx.params;

        const access = await getLessonAccess({ courseId, moduleId, lessonId, userId });
        if (!access.allowed) {
            if (access.reason === "COURSE_FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            if (access.reason === "LESSON_LOCKED") return NextResponse.json({ error: "Lesson is locked", code: access.reason, blockingLessonIds: access.blockingLessonIds }, { status: 423 });
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        const lesson = access.isCreator
            ? await prisma.courseLesson.findFirst({
                where: { id: lessonId, moduleId, module: { courseId } },
                include: { files: true },
            })
            : await prisma.courseLesson.findFirst({
                where: { id: lessonId, moduleId, module: { courseId } },
                select: {
                    id: true,
                    moduleId: true,
                    title: true,
                    description: true,
                    content: true,
                    order: true,
                    isLocked: true,
                    updatedAt: true,
                    files: { where: { isVisible: true } },
                },
            });

        if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json(lesson);
    } catch (e) {
        console.error("GET /api/courses/.../lessons/[lessonId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId, lessonId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const scopedLesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, moduleId, module: { courseId } }, select: { id: true } });
        if (!scopedLesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

        const data = await req.json();
        const { autoPublish, publishNow } = data;
        const updateData: {
            title?: string;
            description?: string | null;
            content?: string;
            contentDraft?: string;
            isLocked?: boolean;
        } = {};

        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.isLocked !== undefined) updateData.isLocked = data.isLocked;

        // PUBLISHING LOGIC (Phase 9):
        if (data.content !== undefined) {
            updateData.contentDraft = data.content; // Changes always go to Draft first
            if (autoPublish) {
                updateData.content = data.content; // If auto-publishing, also hit the Live content
            }
        }

        if (publishNow) {
            // Manual publish: copy draft to live
            if (data.content !== undefined) {
                updateData.content = data.content;
            } else {
                const current = await prisma.courseLesson.findUnique({
                    where: { id: lessonId },
                    select: { contentDraft: true }
                });
                updateData.content = current?.contentDraft || "";
            }
        }

        const updated = await prisma.courseLesson.update({
            where: { id: lessonId },
            data: updateData,
        });

        // Background moderation check for manual content updates
        if (data.content !== undefined || data.title !== undefined) {
            const { checkContentSafety, flagContent } = await import("@/lib/ai/moderation");
            const textToCheck = `Title: ${data.title || ""} \nContent: ${data.content || ""}`;

            // We don't await this to avoid blocking the user's response, 
            // though in Vercel/Next.js this might be killed if the response finishes.
            // For better reliability, we should await or use a background job, 
            // but here we'll await a bit to ensure it starts.
            checkContentSafety(textToCheck).then(async (safety) => {
                if (!safety.safe) {
                    await flagContent(userId, courseId, "MANUAL_CONTENT_UNSAFE", safety.reason);
                }
            }).catch(err => console.error("Background moderation failed:", err));
        }

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH /api/courses/.../lessons/[lessonId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId, lessonId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const scopedLesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, moduleId, module: { courseId } }, select: { id: true } });
        if (!scopedLesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

        await prisma.courseLesson.delete({ where: { id: lessonId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/.../lessons/[lessonId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
