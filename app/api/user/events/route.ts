import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";
import { baseEventId, expandRecurringEvents, recurrencePattern } from "@/lib/event-recurrence";

const accessibleEvents = (userId: string) => ({
    AND: [
        {
            OR: [
                { userId },
                { classroom: { is: { members: { some: { userId } } } } },
            ],
        },
        {
            OR: [
                { assignmentId: null, testId: null },
                { assignment: { is: { posts: { some: {} } } } },
                { test: { is: { posts: { some: {} } } } },
            ],
        },
    ],
});

const eventAccessInclude = (userId: string) => ({
    classroom: { select: { id: true, name: true, members: { where: { userId }, select: { role: true } } } },
    reminders: { where: { userId }, select: { notifyAt: true, notificationProcessedAt: true } },
});

type EventAccessRecord = {
    userId?: string | null;
    classroomId?: string | null;
    startDate: Date;
    endDate?: Date | null;
    startTime?: string | null;
    isAllDay: boolean;
    recurrencePattern?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
    classroom?: { id: string; name: string; members: Array<{ role: string }> } | null;
    reminders?: Array<{ notifyAt: Date | null; notificationProcessedAt: Date | null }>;
} & Record<string, unknown>;

function serializeEvent(event: EventAccessRecord, userId: string) {
    const classroomRole = event.classroom?.members?.[0]?.role;
    const { reminders, ...eventFields } = event;
    const reminder = reminders?.[0];
    return {
        ...eventFields,
        source: event.classroomId ? "classroom" : "personal",
        canEdit: event.userId === userId || Boolean(classroomRole && classroomRole !== "STUDENT"),
        classroomName: event.classroom?.name ?? null,
        classroom: event.classroom ? { id: event.classroom.id, name: event.classroom.name } : null,
        reminder: reminder?.notifyAt ? {
            notifyAt: reminder.notifyAt.toISOString(),
            notificationProcessedAt: reminder.notificationProcessedAt?.toISOString() ?? null,
        } : null,
    };
}

function eventRangeWhere(start: Date, end: Date) {
    return {
        OR: [
            { startDate: { gte: start, lte: end } },
            { recurrencePattern: { not: null }, startDate: { lte: end } },
        ],
    };
}

function expandEventRange(events: EventAccessRecord[], start: Date, end: Date) {
    return expandRecurringEvents(
        events.map((event) => ({ ...event, endDate: event.endDate ?? event.startDate })) as Array<EventAccessRecord & { id: string; endDate: Date }>,
        start,
        end,
    );
}

function sortEvents(events: EventAccessRecord[]) {
    return [...events].sort((left, right) => {
        const dateDifference = left.startDate.getTime() - right.startDate.getTime();
        if (dateDifference) return dateDifference;
        if (left.isAllDay !== right.isAllDay) return left.isAllDay ? -1 : 1;
        return (left.startTime ?? "").localeCompare(right.startTime ?? "");
    });
}

function parseDateParam(value: string | null, endOfDay = false) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) return null;
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
    return date;
}

function dateWithTime(dateValue: string | Date, time: string | null | undefined) {
    const date = new Date(dateValue);
    if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        date.setHours(hours, minutes, 0, 0);
    }
    return date;
}

async function syncEventReminders(event: { id: string; title: string; startDate: Date; startTime: string | null; isAllDay: boolean }) {
    const boundary = dateWithTime(event.startDate, event.isAllDay ? null : event.startTime);
    if (event.isAllDay) boundary.setHours(23, 59, 0, 0);
    await prisma.reminder.deleteMany({ where: { eventId: event.id, notifyAt: { gt: boundary } } });
    await prisma.reminder.updateMany({
        where: { eventId: event.id },
        data: { task: event.title, date: event.startDate, time: event.startTime, dueAt: boundary },
    });
}

export async function GET(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const month = searchParams.get("month"); // YYYY-MM
    const upcoming = searchParams.get("upcoming"); // number
    const id = searchParams.get("id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (id) {
        const recordId = baseEventId(id);
        const event = await prisma.event.findFirst({
            where: { id: recordId, ...accessibleEvents(userId) },
            include: eventAccessInclude(userId),
        });
        if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
        if (recordId !== id) {
            const occurrenceDate = parseDateParam(id.slice(recordId.length + 2), true);
            if (!occurrenceDate) return NextResponse.json({ error: "Event not found" }, { status: 404 });
            const occurrenceStart = new Date(occurrenceDate);
            occurrenceStart.setHours(0, 0, 0, 0);
            const occurrence = expandEventRange([event as EventAccessRecord], occurrenceStart, occurrenceDate)
                .find((candidate) => candidate.id === id);
            if (!occurrence) return NextResponse.json({ error: "Event not found" }, { status: 404 });
            return NextResponse.json(serializeEvent(occurrence, userId));
        }
        return NextResponse.json(serializeEvent(event as EventAccessRecord, userId));
    }

    if (from || to) {
        const start = parseDateParam(from);
        const end = parseDateParam(to, true);
        if (!start || !end || end < start) {
            return NextResponse.json(
                { error: "A valid from/to date range is required." },
                { status: 400 },
            );
        }

        const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
        if (rangeDays > 62) {
            return NextResponse.json(
                { error: "The requested date range is too large." },
                { status: 400 },
            );
        }

        const events = await prisma.event.findMany({
            where: {
                ...accessibleEvents(userId),
                ...eventRangeWhere(start, end),
            },
            orderBy: [
                { startDate: "asc" },
                { isAllDay: "desc" },
                { startTime: "asc" },
                { order: "asc" },
            ],
            include: eventAccessInclude(userId),
        });

        const expanded = sortEvents(expandEventRange(events as EventAccessRecord[], start, end));
        return NextResponse.json(expanded.map((event) => serializeEvent(event, userId)));
    }

    // Return next N upcoming events
    if (upcoming) {
        const requestedLimit = Number.parseInt(upcoming, 10);
        if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
            return NextResponse.json({ error: "Upcoming limit must be between 1 and 50." }, { status: 400 });
        }
        const limit = requestedLimit;
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const horizon = new Date(startOfToday);
        horizon.setFullYear(horizon.getFullYear() + 1);

        // Fetch events starting from today (buffered)
        const events = await prisma.event.findMany({
            where: {
                ...accessibleEvents(userId),
                ...eventRangeWhere(startOfToday, horizon),
            },
            orderBy: [
                { startDate: "asc" },
                { startTime: "asc" }
            ],
            take: 500,
            include: eventAccessInclude(userId),
        });

        // Filter: Keep future dates OR today if time is later than now
        const upcomingEvents = sortEvents(expandEventRange(events as EventAccessRecord[], startOfToday, horizon)).filter((event: EventAccessRecord) => {
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

        return NextResponse.json(upcomingEvents.map((event: EventAccessRecord) => serializeEvent(event, userId)));
    }

    // Return events for a specific month
    if (month) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return NextResponse.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
        }
        const [yearStr, monthStr] = month.split("-");
        const y = Number.parseInt(yearStr, 10);
        const m = Number.parseInt(monthStr, 10) - 1; // JS months are 0-indexed
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

        const events = await prisma.event.findMany({
            where: {
                ...accessibleEvents(userId),
                ...eventRangeWhere(start, end),
            },
            orderBy: [{ order: "asc" }, { startTime: "asc" }],
            include: eventAccessInclude(userId),
        });
        const expanded = sortEvents(expandEventRange(events as EventAccessRecord[], start, end));
        return NextResponse.json(expanded.map((event) => serializeEvent(event, userId)));
    }

    // Legacy fallback is bounded to prevent an unbounded database response.
    const events = await prisma.event.findMany({
        where: accessibleEvents(userId),
        orderBy: [{ startDate: "desc" }, { order: "asc" }, { startTime: "asc" }],
        take: 200,
        include: eventAccessInclude(userId),
    });
    return NextResponse.json(events.map((event: EventAccessRecord) => serializeEvent(event, userId)));
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
    const parsedRecurrence = recurrencePattern(body.recurrencePattern);
    if (body.recurrencePattern !== undefined && parsedRecurrence === undefined) {
        return NextResponse.json({ error: "Invalid recurrence pattern." }, { status: 400 });
    }

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
            recurrencePattern: parsedRecurrence ?? null,
            order: newOrder,
            userId,
        },
    });

    return NextResponse.json(serializeEvent({ ...event, classroom: null, reminders: [] } as EventAccessRecord, userId), { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedId = req.nextUrl.searchParams.get("id");
    if (!requestedId) {
        return NextResponse.json({ error: "Event ID required." }, { status: 400 });
    }
    const id = baseEventId(requestedId);

    // Ensure the event belongs to the current user
    const event = await prisma.event.findUnique({ where: { id }, include: eventAccessInclude(userId) });
    const role = event?.classroom?.members?.[0]?.role;
    const canEdit = event?.userId === userId || Boolean(role && role !== "STUDENT");
    if (!event || !canEdit) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.isProtected && event.assignmentId) {
        return NextResponse.json({ error: "Assignments must be managed from their assignment editor." }, { status: 409 });
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
    const requestedId = body.id;
    if (!requestedId) {
        return NextResponse.json({ error: "Event ID required." }, { status: 400 });
    }
    const id = baseEventId(requestedId);

    const event = await prisma.event.findUnique({ where: { id }, include: eventAccessInclude(userId) });
    const role = event?.classroom?.members?.[0]?.role;
    const canEdit = event?.userId === userId || Boolean(role && role !== "STUDENT");
    if (!event || !canEdit) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.isProtected && event.assignmentId) {
        return NextResponse.json({ error: "Assignments must be managed from their assignment editor." }, { status: 409 });
    }

    const parsedRecurrence = recurrencePattern(body.recurrencePattern);
    if (body.recurrencePattern !== undefined && parsedRecurrence === undefined) {
        return NextResponse.json({ error: "Invalid recurrence pattern." }, { status: 400 });
    }
    if (parsedRecurrence && (event.isProtected || event.classroomId)) {
        return NextResponse.json({ error: "Only personal events can repeat." }, { status: 409 });
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
    if (body.recurrencePattern !== undefined) data.recurrencePattern = parsedRecurrence;

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
        await syncEventReminders(updated);
        return NextResponse.json(serializeEvent({ ...updated, classroom: event.classroom, reminders: event.reminders }, userId));
    }

    const updated = parsedRecurrence
        ? (await prisma.$transaction([
            prisma.event.update({ where: { id }, data }),
            prisma.reminder.deleteMany({ where: { eventId: id } }),
        ]))[0]
        : await prisma.event.update({ where: { id }, data });

    await syncEventReminders(updated);

    return NextResponse.json(serializeEvent({ ...updated, classroom: event.classroom, reminders: parsedRecurrence ? [] : event.reminders }, userId));
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

    const ids = body.map((item: { id: string }) => baseEventId(item.id));
    const ownedCount = await prisma.event.count({ where: { id: { in: ids }, userId, isProtected: false, recurrencePattern: null } });
    if (ownedCount !== ids.length) {
        return NextResponse.json({ error: "Protected Classroom events cannot be reordered" }, { status: 403 });
    }

    await prisma.$transaction(
        body.map((item: { id: string; order: number }) =>
            prisma.event.update({
                where: { id: baseEventId(item.id), userId }, // Ensure user owns event
                data: { order: item.order },
            })
        )
    );

    return NextResponse.json({ success: true });
}
