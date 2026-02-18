import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id] — Get classroom details
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        // Check membership
        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const classroom = await prisma.classroom.findUnique({
            where: { id },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                _count: { select: { members: true, posts: true } },
            },
        });

        if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({
            ...classroom,
            role: membership.role,
        });
    } catch (e) {
        console.error("GET /api/classrooms/[id]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/classrooms/[id] — Update classroom (teacher only)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can update classrooms" }, { status: 403 });
        }

        const data = await req.json();
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.subject !== undefined) updateData.subject = data.subject?.trim() || null;
        if (data.color !== undefined) updateData.color = data.color || null;

        const updated = await prisma.classroom.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH /api/classrooms/[id]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id] — Delete classroom (creator only)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const classroom = await prisma.classroom.findUnique({ where: { id } });
        if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (classroom.createdById !== userId) {
            return NextResponse.json({ error: "Only the creator can delete" }, { status: 403 });
        }

        await prisma.classroom.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/classrooms/[id]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
