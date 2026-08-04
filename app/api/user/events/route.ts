import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";

const accessibleEvents = (userId: string) => ({
    OR: [
        { userId },
        { classroom: { is: { members: { some: { userId } } } } },
    ],
});

const eventAccessInclude = (userId: string) => ({
    classroom: { select: { id: true, members: { where: { userId }, select: { role: true } } } },
});

function serializeEvent(event: any, userId: string) {
    const classroomRole = event.classroom?.members?.[0]?.role;
    return {
        ...event,
        canEdit: event.userId === userId || Boolean(classroomRole && classroomRole !== "STUDENT"),
        classroom: event.classroom ? { id: event.classroom.id } : null,
    };
}

function dateWithTime(dateValue: string | Date, time: string | null | undefined) {
    const date = new Date(dateValue);
    if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        date.setHours(hours, minutes, 0, 0);
    }
    return date;
}

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
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // Fetch events starting from today (buffered)
        const events = await prisma.event.findMany({
            where: {
                ...accessibleEvents(userId),
                startDate: {
                    gte: startOfToday,
                },
            },
            orderBy: [
                { startDate: "asc" },
                { startTime: "asc" }
            ],
            take: limit + 5, // Fetch extra to filter in memory
            include: eventAccessInclude(userId),
        });

        // Filter: Keep future dates OR today if time is later than now
        const upcomingEvents = events.filter((event: any) => {
            const eventDate = new Date(event.startDate);
            const isToday =
                eventDate.getDate() === now.getDate() &&
                eventDate.getMonth() === now.getMonth() &&
                eventDate.getFullYear() === now.getFullYear();

            if (isToday) {
                if (event.isAllDay) return true;
                if (!event.startTime) return true;

                const [h, m] = event.startTime.split(":").map(Number);
                const eventMinutes = h * 60 + m;
                const currentMinutes = now.getHours() * 60 + now.getMinutes(); // current minutes

                return eventMinutes > currentMinutes;
            }

            return true; // Future dates (already guaranteed by SQL query to be >= today)
        }).slice(0, limit);

        return NextResponse.json(upcomingEvents.map((event: any) => serializeEvent(event, userId)));
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
                ...accessibleEvents(userId),
                startDate: { gte: start, lte: end },
            },
            orderBy: [{ order: "asc" }, { startTime: "asc" }],
            include: eventAccessInclude(userId),
        });
        return NextResponse.json(events.map((event: any) => serializeEvent(event, userId)));
    }

    // Default: return all user events
    const events = await prisma.event.findMany({
        where: accessibleEvents(userId),
        orderBy: [{ order: "asc" }, { startTime: "asc" }],
        include: eventAccessInclude(userId),
    });
    return NextResponse.json(events.map((event: any) => serializeEvent(event, userId)));
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
            color: body.color || null,
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
    const event = await prisma.event.findUnique({ where: { id }, include: eventAccessInclude(userId) });
    const role = event?.classroom?.members?.[0]?.role;
    const canEdit = event?.userId === userId || Boolean(role && role !== "STUDENT");
    if (!event || !canEdit) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.isProtected && event.testId && event.classroomId) {
        await prisma.$transaction([
            prisma.event.delete({ where: { id } }),
            prisma.test.update({ where: { id: event.testId }, data: { opensAt: null, closesAt: null } }),
        ]);
        await notifyClassroomMembers({
            classroomId: event.classroomId,
            actorId: userId,
            title: "Test date removed",
            body: `${event.title} is no longer scheduled.`,
            type: "EVENT",
            relatedId: event.testId,
            relatedType: "test",
            actionUrl: `/classroom/${event.classroomId}/tests/${event.testId}`,
        });
    } else {
        await prisma.event.delete({ where: { id } });
    }
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

    const event = await prisma.event.findUnique({ where: { id }, include: eventAccessInclude(userId) });
    const role = event?.classroom?.members?.[0]?.role;
    const canEdit = event?.userId === userId || Boolean(role && role !== "STUDENT");
    if (!event || !canEdit) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.startTime !== undefined) data.startTime = body.startTime || null;
    if (body.endTime !== undefined) data.endTime = body.endTime || null;
    if (body.isAllDay !== undefined) data.isAllDay = Boolean(body.isAllDay);
    if (body.color !== undefined) data.color = body.color || null;
    if (body.order !== undefined) data.order = parseInt(body.order);
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);

    if (event.isProtected && event.testId && event.classroomId) {
        const startDate = dateWithTime(
            body.startDate ?? event.startDate,
            body.isAllDay ? null : (body.startTime ?? event.startTime),
        );
        const endDate = dateWithTime(
            body.endDate ?? body.startDate ?? event.endDate,
            body.isAllDay ? null : (body.endTime ?? event.endTime),
        );
        data.startDate = startDate;
        data.endDate = endDate;
        const [updated] = await prisma.$transaction([
            prisma.event.update({ where: { id }, data }),
            prisma.test.update({
                where: { id: event.testId },
                data: {
                    title: body.title !== undefined ? body.title.trim().replace(/^(test|exam):\s*/i, "") : undefined,
                    description: body.description !== undefined ? body.description || null : undefined,
                    opensAt: startDate,
                    closesAt: endDate,
                },
            }),
        ]);
        await notifyClassroomMembers({
            classroomId: event.classroomId,
            actorId: userId,
            title: "Test rescheduled",
            body: `${updated.title} was changed in the calendar.`,
            type: "EVENT",
            relatedId: event.testId,
            relatedType: "test",
            actionUrl: `/classroom/${event.classroomId}/tests/${event.testId}`,
        });
        return NextResponse.json(serializeEvent({ ...updated, classroom: event.classroom }, userId));
    }

    const updated = await prisma.event.update({
        where: { id },
        data,
    });

    return NextResponse.json(serializeEvent({ ...updated, classroom: event.classroom }, userId));
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

    const ids = body.map((item: { id: string }) => item.id);
    const ownedCount = await prisma.event.count({ where: { id: { in: ids }, userId, isProtected: false } });
    if (ownedCount !== ids.length) {
        return NextResponse.json({ error: "Protected Classroom events cannot be reordered" }, { status: 403 });
    }

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
