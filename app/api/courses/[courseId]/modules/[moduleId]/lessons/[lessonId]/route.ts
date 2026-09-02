import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canManageCourse, getLessonAccess } from "@/lib/course-access";
import { normalizeGeneratedRichText, richTextToPlainText, sanitizeRichTextHtml } from "@/lib/security/rich-text";
import { markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";
import type { Prisma } from "@/lib/generated/prisma";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string; lessonId: string }> };
type StoredLessonFile = { storedFileId: string | null; fileUrl: string | null };
type StoredFileReference = { storedFileId: string | null };

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

        return NextResponse.json({
            ...lesson,
            content: normalizeGeneratedRichText(lesson.content),
            files: lesson.files?.map((file: StoredLessonFile) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })),
        });
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
        const scopedLesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, moduleId, module: { courseId } }, select: { id: true, files: { select: { storedFileId: true } } } });
        if (!scopedLesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

        const data = await req.json();
        const sanitizedContent = data.content !== undefined ? sanitizeRichTextHtml(data.content) : undefined;
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

        if (data.content !== undefined) {
            updateData.contentDraft = sanitizedContent;
        }

        const updated = await prisma.courseLesson.update({
            where: { id: lessonId },
            data: updateData,
        });

        // Await advisory moderation so flagged reports are durable before responding.
        if (data.content !== undefined || data.title !== undefined) {
            const { checkContentSafety, flagContent } = await import("@/lib/ai/moderation");
            const textToCheck = `Title: ${updated.title}\nContent: ${richTextToPlainText(updated.contentDraft ?? updated.content ?? "")}`;
            const safety = await checkContentSafety(textToCheck, { courseId, lessonId, operation: "manual_lesson_update" });
            if (!safety.safe) await flagContent(userId, courseId, "MANUAL_CONTENT_UNSAFE", safety.reason);
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
        const scopedLesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, moduleId, module: { courseId } }, select: { id: true, files: { select: { storedFileId: true } } } });
        if (!scopedLesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

        const storedFileIds = scopedLesson.files.flatMap((file: StoredFileReference) => file.storedFileId ? [file.storedFileId] : []);
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await markFilesForDeletion(tx, storedFileIds);
            await tx.courseLesson.delete({ where: { id: lessonId } });
        });
        await purgeStoredFiles(storedFileIds);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/.../lessons/[lessonId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
