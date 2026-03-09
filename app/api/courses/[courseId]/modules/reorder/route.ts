import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string }> };

// PUT /api/courses/[courseId]/modules/reorder — Bulk reorder modules
export async function PUT(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (course.createdById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const { list } = data; // Array of { id: string, order: number }

        if (!Array.isArray(list)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Use a transaction to perform batch updates securely
        await prisma.$transaction(
            list.map((item: any) =>
                prisma.courseModule.update({
                    where: { id: item.id, courseId },
                    data: { order: item.order },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("PUT /api/courses/[courseId]/modules/reorder", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
