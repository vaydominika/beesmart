import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

export async function GET(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requestedCategory = req.nextUrl.searchParams.get("category");
    const category = requestedCategory === "CLASSROOM" || requestedCategory === "GENERAL"
        ? requestedCategory
        : undefined;
    const notifications = await prisma.notification.findMany({
        where: { userId, ...(category ? { category } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });

    return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const read = body.read !== false;
    const readAt = read ? new Date() : null;

    if (body.all === true) {
        const category = body.category === "CLASSROOM" || body.category === "GENERAL" ? body.category : undefined;
        await prisma.notification.updateMany({
            where: { userId, ...(category ? { category } : {}), ...(read ? { readAt: null } : {}) },
            data: { readAt },
        });
        return NextResponse.json({ success: true });
    }

    if (!body.id) return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    const notification = await prisma.notification.findFirst({ where: { id: body.id, userId } });
    if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { readAt } });
    return NextResponse.json(updated);
}

