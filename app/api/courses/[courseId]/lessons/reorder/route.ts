import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";

type RouteContext = { params: Promise<{ courseId: string }> };

// PUT /api/courses/[courseId]/lessons/reorder — Bulk reorder lessons (supports moving between modules)
export async function PUT(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const { list } = data; // Array of { id: string, order: number, moduleId: string }

        if (!Array.isArray(list)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        const destinationModules = await prisma.courseModule.count({
            where: { courseId, id: { in: [...new Set(list.map((item: any) => item.moduleId))] } },
        });
        if (destinationModules !== new Set(list.map((item: any) => item.moduleId)).size) {
            return NextResponse.json({ error: "A destination module does not belong to this course" }, { status: 400 });
        }
        const scopedLessons = await prisma.courseLesson.count({
            where: { id: { in: list.map((item: any) => item.id) }, module: { courseId } },
        });
        if (scopedLessons !== new Set(list.map((item: any) => item.id)).size) {
            return NextResponse.json({ error: "A lesson does not belong to this course" }, { status: 400 });
        }

        // Use a transaction to perform batch updates securely
        await prisma.$transaction(
            list.map((item: any) =>
                prisma.courseLesson.update({
                    where: { id: item.id },
                    data: {
                        order: item.order,
                        moduleId: item.moduleId
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("PUT /api/courses/[courseId]/lessons/reorder", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
