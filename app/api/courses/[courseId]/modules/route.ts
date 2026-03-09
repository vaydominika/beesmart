import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string }> };

// GET /api/courses/[courseId]/modules — Get modules for a course
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { isPublic: true, createdById: true },
        });

        if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

        // Check if user has access
        const isCreator = course.createdById === userId;
        const isEnrolled = await prisma.courseEnrollment.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });

        if (!isCreator && !isEnrolled && !course.isPublic) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const modules = await prisma.courseModule.findMany({
            where: { courseId },
            orderBy: { order: "asc" },
            include: {
                lessons: {
                    orderBy: { order: "asc" },
                    select: { id: true, title: true, description: true, order: true }
                }
            }
        });

        return NextResponse.json(modules);
    } catch (e) {
        console.error("GET /api/courses/[courseId]/modules", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/courses/[courseId]/modules — Create a new module
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const { title, description } = data;

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        // Find max order
        const lastModule = await prisma.courseModule.findFirst({
            where: { courseId },
            orderBy: { order: "desc" },
            select: { order: true },
        });

        const nextOrder = lastModule ? lastModule.order + 1 : 0;

        const newModule = await prisma.courseModule.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                courseId,
                order: nextOrder,
            },
            include: { lessons: true }
        });

        return NextResponse.json(newModule);
    } catch (e) {
        console.error("POST /api/courses/[courseId]/modules", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
