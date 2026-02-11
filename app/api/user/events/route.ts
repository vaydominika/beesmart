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
            orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
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
            orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
        });
        return NextResponse.json(events);
    }

    // Default: return all user events
    const events = await prisma.event.findMany({
        where: { userId },
        orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
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

    const event = await prisma.event.create({
        data: {
            title: body.title,
            description: body.description || null,
            startDate,
            endDate,
            startTime: body.startTime || null,
            endTime: body.endTime || null,
            isAllDay: body.isAllDay ?? false,
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

    const updated = await prisma.event.update({
        where: { id },
        data,
    });

    return NextResponse.json(updated);
}
