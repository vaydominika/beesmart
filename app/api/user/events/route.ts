import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

export async function GET(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const month = searchParams.get("month"); // YYYY-MM
    const upcoming = searchParams.get("upcoming"); // number

    // Return next N upcoming events
    if (upcoming) {
        const limit = parseInt(upcoming) || 2;
        const now = new Date();
        const events = await prisma.event.findMany({
            where: {
                userId,
                startDate: { gte: now },
            },
            orderBy: [{ order: "asc" }, { startTime: "asc" }],
            take: limit,
        });
        return NextResponse.json(events);
    }

    // Return events for a specific month
    if (month) {
        const [yearStr, monthStr] = month.split("-");
        const y = parseInt(yearStr);
        const m = parseInt(monthStr) - 1; // JS months are 0-indexed
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

        const events = await prisma.event.findMany({
            where: {
                userId,
                startDate: { gte: start, lte: end },
            },
            orderBy: [{ order: "asc" }, { startTime: "asc" }],
        });
        return NextResponse.json(events);
    }

    // Default: return all user events
    const events = await prisma.event.findMany({
        where: { userId },
        orderBy: [{ order: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json(events);
}

export async function POST(req: Request) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.title || !body.startDate) {
        return NextResponse.json(
            { error: "Title and start date are required." },
            { status: 400 }
        );
    }

    const startDate = new Date(body.startDate);
    const endDate = body.endDate ? new Date(body.endDate) : startDate;

    // Get max order for this day to append at end
    const lastEvent = await prisma.event.findFirst({
        where: {
            userId,
            startDate: { gte: startDate, lte: endDate }, // Same day (roughly)
        },
        orderBy: { order: "desc" },
    });
    const newOrder = (lastEvent?.order ?? -1) + 1;

    const event = await prisma.event.create({
        data: {
            title: body.title,
            description: body.description || null,
            startDate,
            endDate,
            startTime: body.startTime || null,
            endTime: body.endTime || null,
            isAllDay: body.isAllDay ?? false,
            order: newOrder,
            userId,
        },
    });

    return NextResponse.json(event, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "Event ID required." }, { status: 400 });
    }

    // Ensure the event belongs to the current user
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.userId !== userId) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = body.id;
    if (!id) {
        return NextResponse.json({ error: "Event ID required." }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event || event.userId !== userId) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.startTime !== undefined) data.startTime = body.startTime || null;
    if (body.endTime !== undefined) data.endTime = body.endTime || null;
    if (body.isAllDay !== undefined) data.isAllDay = Boolean(body.isAllDay);
    if (body.order !== undefined) data.order = parseInt(body.order);

    const updated = await prisma.event.update({
        where: { id },
        data,
    });

    return NextResponse.json(updated);
}

export async function PUT(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!Array.isArray(body)) {
        return NextResponse.json({ error: "Expected array of updates" }, { status: 400 });
    }

    // Bulk update order
    // In a transaction for safety
    await prisma.$transaction(
        body.map((item: { id: string; order: number }) =>
            prisma.event.update({
                where: { id: item.id, userId }, // Ensure user owns event
                data: { order: item.order },
            })
        )
    );

    return NextResponse.json({ success: true });
}
