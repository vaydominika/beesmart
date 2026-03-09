import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string; lessonId: string }> };

// GET /api/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, lessonId } = await ctx.params;

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { isPublic: true, createdById: true },
        });

        if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

        const isCreator = course.createdById === userId;
        const isEnrolled = await prisma.courseEnrollment.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });

        if (!isCreator && !isEnrolled && !course.isPublic) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const lesson = await prisma.courseLesson.findUnique({
            where: { id: lessonId },
            include: { files: true }
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
        const { courseId, lessonId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.content !== undefined) updateData.content = data.content;

        const updated = await prisma.courseLesson.update({
            where: { id: lessonId },
            data: updateData,
        });

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
        const { courseId, lessonId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await prisma.courseLesson.delete({ where: { id: lessonId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/.../lessons/[lessonId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
