import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";

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

        // Urgent announcements remain active until a teacher explicitly cancels them.
        const active = announcements.filter(
            (a: any) => a.priority === "URGENT" || !a.expiresAt || new Date(a.expiresAt) > now
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
                expiresAt: priority === "URGENT" ? null : (expiresAt ? new Date(expiresAt) : null),
                isPinned: isPinned || false,
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
            },
        });

        await notifyClassroomMembers({
            classroomId: id, actorId: userId, title: "New announcement", body: title.trim(),
            type: "ANNOUNCEMENT", relatedId: announcement.id, relatedType: "announcement",
            actionUrl: `/classroom/${id}`,
        });
        await recordMeaningfulActivity({
            userId, activityType: "CLASSROOM_POST_PUBLISHED", classroomId: id, relatedId: announcement.id,
            dedupeKey: `announcement:create:${announcement.id}`,
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

        const result = await prisma.announcement.deleteMany({
            where: { id: announcementId, classroomId: id },
        });
        if (result.count === 0) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE announcement", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
