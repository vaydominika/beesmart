export type ScheduleView = "week" | "month";

export type EventSource = "personal" | "classroom";
export type RecurrencePattern = "DAILY" | "WEEKLY" | "MONTHLY";
export type RecurrenceSelection = "NONE" | RecurrencePattern;

export const RECURRENCE_OPTIONS: ReadonlyArray<{ value: RecurrenceSelection; label: string }> = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export interface ScheduleEvent {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  color?: string | null;
  recurrencePattern?: RecurrencePattern | null;
  seriesId?: string | null;
  seriesStartDate?: string | null;
  source: EventSource;
  classroomId?: string | null;
  classroomName?: string | null;
  testId?: string | null;
  assignmentId?: string | null;
  isProtected?: boolean;
  canEdit?: boolean;
  reminder?: ScheduleEventReminder | null;
}

export interface ScheduleSelectionProps {
  onSelectEvent: (event: ScheduleEvent) => void;
}

export interface ScheduleEventReminder {
  notifyAt: string;
  notificationProcessedAt: string | null;
}

export interface ScheduleEventReminderInput {
  notifyAt: string;
  eventStartsAt: string;
  timeZone: string;
}

export interface ScheduleEventInput {
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  color: string;
  recurrencePattern: RecurrencePattern | null;
  reminder: ScheduleEventReminderInput | null;
}

export interface ScheduleRange {
  start: Date;
  end: Date;
}

export const HOUR_HEIGHT = 72;
export const MINUTES_PER_STEP = 15;

export function dateKey(value: string | Date): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function endOfWeek(date: Date): Date {
  const end = addDays(startOfWeek(date), 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function monthGridRange(date: Date): ScheduleRange {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  const end = addDays(start, 41);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function rangeForView(view: ScheduleView, date: Date): ScheduleRange {
  if (view === "month") return monthGridRange(date);
  return { start: startOfWeek(date), end: endOfWeek(date) };
}

export function parseTime(value?: string | null): number {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / MINUTES_PER_STEP) * MINUTES_PER_STEP;
}

export function eventDuration(event: ScheduleEvent): number {
  if (!event.startTime) return 60;
  const duration = parseTime(event.endTime) - parseTime(event.startTime);
  return Math.max(MINUTES_PER_STEP, duration || 60);
}

export function eventsForDate(events: ScheduleEvent[], date: Date | string): ScheduleEvent[] {
  const key = typeof date === "string" ? dateKey(date) : dateKey(date);
  return events
    .filter((event) => dateKey(event.startDate) === key)
    .sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      return parseTime(a.startTime) - parseTime(b.startTime);
    });
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return dateKey(a) === dateKey(b);
}

export function sourceLabel(source: EventSource): string {
  if (source === "classroom") return "Classroom";
  return "Personal";
}

export function recurrenceLabel(pattern?: RecurrencePattern | null): string {
  if (pattern === "DAILY") return "Repeats daily";
  if (pattern === "WEEKLY") return "Repeats weekly";
  if (pattern === "MONTHLY") return "Repeats monthly";
  return "Does not repeat";
}

export function eventRecordId(event: Pick<ScheduleEvent, "id" | "seriesId">): string {
  return event.seriesId || event.id;
}

export function eventSourceLabel(event: Pick<ScheduleEvent, "source" | "classroomName">): string {
  const classroomName = event.classroomName?.trim();
  if (event.source === "classroom" && classroomName) return `Classroom ${classroomName}`;
  return sourceLabel(event.source);
}

export function eventTimeLabel(event: Pick<ScheduleEvent, "assignmentId" | "endDate" | "isAllDay" | "startDate" | "startTime" | "testId">): string {
  if (!event.isAllDay) return event.startTime || "—";
  if (!event.assignmentId && !event.testId) return "All day";

  const dueDate = parseDateKey(dateKey(event.endDate || event.startDate));
  return `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function formatLongDate(date: Date, options: { includeYear?: boolean } = {}): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: options.includeYear === false ? undefined : "numeric",
  });
}

export function getNowMinutes(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}
