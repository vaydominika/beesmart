import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string }> };

// GET /api/courses/[courseId]/modules/[moduleId]/lessons
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId } = await ctx.params;

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

        const lessons = await prisma.courseLesson.findMany({
            where: { moduleId },
            orderBy: { order: "asc" },
        });

        return NextResponse.json(lessons);
    } catch (e) {
        console.error("GET /api/courses/[courseId]/modules/[moduleId]/lessons", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/courses/[courseId]/modules/[moduleId]/lessons
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const { title, description, content } = data;

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        // Find max order
        const lastLesson = await prisma.courseLesson.findFirst({
            where: { moduleId },
            orderBy: { order: "desc" },
            select: { order: true },
        });

        const nextOrder = lastLesson ? lastLesson.order + 1 : 0;

        const newLesson = await prisma.courseLesson.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                content: content || null,
                moduleId,
                order: nextOrder,
            },
        });

        return NextResponse.json(newLesson);
    } catch (e) {
        console.error("POST /api/courses/[courseId]/modules/[moduleId]/lessons", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
