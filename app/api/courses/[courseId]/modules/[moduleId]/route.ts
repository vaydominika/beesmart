import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string; moduleId: string }> };

// PATCH /api/courses/[courseId]/modules/[moduleId] — Update a module
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId, moduleId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;

        const updated = await prisma.courseModule.update({
            where: { id: moduleId, courseId },
            data: updateData,
            include: { lessons: true }
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

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await prisma.courseModule.delete({ where: { id: moduleId, courseId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/[courseId]/modules/[moduleId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
