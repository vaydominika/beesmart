import { NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { parseEventReminder, serializeEventReminder } from "@/lib/event-reminders";

type RouteContext = { params: Promise<{ id: string }> };

const accessibleEventWhere = (id: string, userId: string) => ({
  id,
  OR: [
    { userId },
    { classroom: { is: { members: { some: { userId } } } } },
  ],
});

async function getAccessibleEvent(id: string, userId: string) {
  return prisma.event.findFirst({
    where: accessibleEventWhere(id, userId),
    select: { id: true, title: true, startDate: true, startTime: true, isAllDay: true },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const event = await getAccessibleEvent(id, userId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const reminder = await prisma.reminder.findUnique({ where: { userId_eventId: { userId, eventId: id } } });
  return NextResponse.json({ reminder: reminder?.notifyAt ? serializeEventReminder(reminder) : null });
}

export async function PUT(request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const [event, settings] = await Promise.all([
    getAccessibleEvent(id, userId),
    prisma.userSettings.findUnique({ where: { userId }, select: { reminderNotifications: true } }),
  ]);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (settings?.reminderNotifications === false) {
    return NextResponse.json({ error: "Reminder notifications are turned off" }, { status: 400 });
  }
  const parsed = parseEventReminder(await request.json().catch(() => null), event);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const reminder = await prisma.reminder.upsert({
    where: { userId_eventId: { userId, eventId: id } },
    create: {
      userId,
      eventId: id,
      task: event.title,
      date: event.startDate,
      time: event.startTime,
      timeZone: parsed.data.timeZone,
      dueAt: parsed.data.eventStartsAt,
      notifyAt: parsed.data.notifyAt,
      notificationProcessedAt: null,
      completed: false,
    },
    update: {
      task: event.title,
      date: event.startDate,
      time: event.startTime,
      timeZone: parsed.data.timeZone,
      dueAt: parsed.data.eventStartsAt,
      notifyAt: parsed.data.notifyAt,
      notificationProcessedAt: null,
      completed: false,
    },
  });
  return NextResponse.json({ reminder: serializeEventReminder(reminder) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const event = await getAccessibleEvent(id, userId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  await prisma.reminder.deleteMany({ where: { userId, eventId: id } });
  return NextResponse.json({ success: true });
}
