import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id]/announcements — Active announcements
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const now = new Date();

        const announcements = await prisma.announcement.findMany({
            where: {
                classroomId: id,
                OR: [
                    { publishAt: null },
                    { publishAt: { lte: now } },
                ],
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
            },
            orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        });

        // Filter out expired announcements (but keep ones without expiresAt)
        const active = announcements.filter(
            (a: any) => !a.expiresAt || new Date(a.expiresAt) > now
        );

        return NextResponse.json(active);
    } catch (e) {
        console.error("GET announcements", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/announcements — Create announcement (teacher only)
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can create announcements" }, { status: 403 });
        }

        const { title, body, priority, publishAt, expiresAt, isPinned } = await req.json();
        if (!title?.trim() || !body?.trim()) {
            return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
        }

        const announcement = await prisma.announcement.create({
            data: {
                classroomId: id,
                authorId: userId,
                title: title.trim(),
                body: body.trim(),
                priority: priority || "INFO",
                publishAt: publishAt ? new Date(publishAt) : null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                isPinned: isPinned || false,
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
            },
        });

        // Create notifications for all members
        const members = await prisma.classroomMember.findMany({
            where: { classroomId: id },
            select: { userId: true },
        });

        const classroom = await prisma.classroom.findUnique({
            where: { id },
            select: { name: true },
        });

        await prisma.notification.createMany({
            data: members
                .filter((m: any) => m.userId !== userId)
                .map((m: any) => ({
                    userId: m.userId,
                    title: `New Announcement in ${classroom?.name}`,
                    body: title.trim(),
                    type: "ANNOUNCEMENT" as const,
                    relatedId: announcement.id,
                    relatedType: "announcement",
                })),
        });

        return NextResponse.json(announcement, { status: 201 });
    } catch (e) {
        console.error("POST announcement", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id]/announcements — Delete announcement
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const { announcementId } = await req.json();
        if (!announcementId) {
            return NextResponse.json({ error: "Announcement ID required" }, { status: 400 });
        }

        await prisma.announcement.delete({ where: { id: announcementId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE announcement", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
