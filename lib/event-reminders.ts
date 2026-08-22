export type ReminderEvent = {
  id: string;
  title: string;
  startDate: Date;
  startTime: string | null;
  isAllDay: boolean;
};

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseEventReminder(payload: unknown, event: ReminderEvent) {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const timeZone = typeof body.timeZone === "string" ? body.timeZone : "";
  const notifyAt = new Date(typeof body.notifyAt === "string" ? body.notifyAt : "");
  const eventStartsAt = new Date(typeof body.eventStartsAt === "string" ? body.eventStartsAt : "");

  if (!isValidTimeZone(timeZone)) return { error: "A valid timezone is required" } as const;
  if (Number.isNaN(notifyAt.getTime()) || notifyAt.getTime() <= Date.now()) {
    return { error: "Reminder time must be in the future" } as const;
  }
  if (Number.isNaN(eventStartsAt.getTime())) return { error: "Invalid event start time" } as const;
  const eventStartDelta = eventStartsAt.getTime() - event.startDate.getTime();
  if (eventStartDelta < -43_200_000 || eventStartDelta > 129_600_000) {
    return { error: "Event start time does not match this event" } as const;
  }
  if (notifyAt > eventStartsAt) return { error: "Reminder time cannot be after the event starts" } as const;

  return { data: { timeZone, notifyAt, eventStartsAt } } as const;
}

export function serializeEventReminder(reminder: {
  notifyAt: Date | null;
  notificationProcessedAt: Date | null;
}) {
  if (!reminder.notifyAt) return null;
  return {
    notifyAt: reminder.notifyAt.toISOString(),
    notificationProcessedAt: reminder.notificationProcessedAt?.toISOString() ?? null,
  };
}
