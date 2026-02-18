import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id]/members — List members
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const members = await prisma.classroomMember.findMany({
            where: { classroomId: id },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        });

        return NextResponse.json(members);
    } catch (e) {
        console.error("GET members", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/classrooms/[id]/members — Change member role
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can change roles" }, { status: 403 });
        }

        const { memberId, role } = await req.json();
        if (!memberId || !role) {
            return NextResponse.json({ error: "Member ID and role required" }, { status: 400 });
        }

        const updated = await prisma.classroomMember.update({
            where: { id: memberId },
            data: { role },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH member", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id]/members — Remove member
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can remove members" }, { status: 403 });
        }

        const { memberId } = await req.json();
        if (!memberId) {
            return NextResponse.json({ error: "Member ID required" }, { status: 400 });
        }

        // Prevent removing the classroom creator
        const memberToRemove = await prisma.classroomMember.findUnique({
            where: { id: memberId },
            include: { classroom: { select: { createdById: true } } },
        });
        if (memberToRemove?.userId === memberToRemove?.classroom.createdById) {
            return NextResponse.json({ error: "Cannot remove the classroom creator" }, { status: 400 });
        }

        await prisma.classroomMember.delete({ where: { id: memberId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE member", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
