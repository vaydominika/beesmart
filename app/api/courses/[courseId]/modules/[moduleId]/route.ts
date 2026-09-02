import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";
import type { Prisma } from "@/lib/generated/prisma";
import { markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string }> };

// PATCH /api/courses/[courseId]/modules/[moduleId] — Update a module
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const courseModule = await prisma.courseModule.findFirst({ where: { id: moduleId, courseId }, select: { id: true } });
        if (!courseModule) return NextResponse.json({ error: "Module not found" }, { status: 404 });

        const data = await req.json();
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;

        if (data.isPrerequisite !== undefined) {
            if (typeof data.isPrerequisite !== "boolean") {
                return NextResponse.json({ error: "isPrerequisite must be a boolean" }, { status: 400 });
            }
            await prisma.courseLesson.updateMany({
                where: { moduleId, module: { courseId } },
                data: { isLocked: data.isPrerequisite },
            });
        }

        const updated = Object.keys(updateData).length > 0
            ? await prisma.courseModule.update({
                where: { id: moduleId, courseId },
                data: updateData,
                include: { lessons: true },
            })
            : await prisma.courseModule.findUnique({
                where: { id: moduleId, courseId },
                include: { lessons: true },
            });

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH /api/courses/[courseId]/modules/[moduleId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/courses/[courseId]/modules/[moduleId] — Delete a module
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const courseModule = await prisma.courseModule.findFirst({
            where: { id: moduleId, courseId },
            select: { id: true, lessons: { select: { files: { select: { storedFileId: true } } } } },
        });
        if (!courseModule) return NextResponse.json({ error: "Module not found" }, { status: 404 });

        const storedFileIds = courseModule.lessons.flatMap((lesson: any) => lesson.files.flatMap((file: any) => file.storedFileId ? [file.storedFileId] : []));
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await markFilesForDeletion(tx, storedFileIds);
            await tx.courseModule.delete({ where: { id: moduleId, courseId } });
        });
        await purgeStoredFiles(storedFileIds);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/[courseId]/modules/[moduleId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
