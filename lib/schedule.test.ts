import { describe, expect, it } from "vitest";
import {
  agendaRange,
  dateKey,
  eventDuration,
  eventSourceLabel,
  eventsForDate,
  monthGridRange,
  snapMinutes,
  startOfWeek,
  type ScheduleEvent,
} from "./schedule";

const baseEvent: ScheduleEvent = {
  id: "event-1",
  title: "Lesson",
  startDate: "2026-08-05T00:00:00.000Z",
  startTime: "09:00",
  endTime: "10:30",
  isAllDay: false,
  source: "personal",
};

describe("schedule date helpers", () => {
  it("normalizes API ISO timestamps to calendar date keys", () => {
    expect(dateKey("2026-08-05T00:00:00.000Z")).toBe("2026-08-05");
  });

  it("uses Monday as the start of the week", () => {
    expect(dateKey(startOfWeek(new Date(2026, 7, 9)))).toBe("2026-08-03");
  });

  it("returns the full six-week month grid range", () => {
    const range = monthGridRange(new Date(2026, 7, 5));
    expect(dateKey(range.start)).toBe("2026-07-27");
    expect(dateKey(range.end)).toBe("2026-09-06");
  });

  it("returns a 30-day agenda range", () => {
    const range = agendaRange(new Date(2026, 7, 5));
    expect(dateKey(range.start)).toBe("2026-08-05");
    expect(dateKey(range.end)).toBe("2026-09-03");
  });
});

describe("schedule event helpers", () => {
  it("snaps interactions to 15-minute increments", () => {
    expect(snapMinutes(67)).toBe(60);
    expect(snapMinutes(68)).toBe(75);
  });

  it("preserves timed event duration", () => {
    expect(eventDuration(baseEvent)).toBe(90);
  });

  it("matches ISO events and sorts all-day events before timed events", () => {
    const allDay: ScheduleEvent = { ...baseEvent, id: "all-day", title: "Exam", isAllDay: true, startTime: null, endTime: null };
    expect(eventsForDate([baseEvent, allDay], "2026-08-05").map((event) => event.id)).toEqual(["all-day", "event-1"]);
  });

  it("identifies the classroom that supplied an event", () => {
    expect(eventSourceLabel({ source: "classroom", classroomName: "Matematika" })).toBe("Classroom · Matematika");
    expect(eventSourceLabel({ source: "classroom", classroomName: null })).toBe("Classroom");
  });
});
