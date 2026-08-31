import { describe, expect, it } from "vitest";
import { baseEventId, expandRecurringEvents, recurrencePattern } from "./event-recurrence";

const event = (pattern: "DAILY" | "WEEKLY" | "MONTHLY" | null, date = "2026-08-03") => ({
  id: "event-1",
  startDate: new Date(`${date}T00:00:00.000Z`),
  endDate: new Date(`${date}T00:00:00.000Z`),
  recurrencePattern: pattern,
});

describe("event recurrence", () => {
  it("expands daily and weekly events with stable occurrence IDs", () => {
    const daily = expandRecurringEvents([event("DAILY")], new Date(2026, 7, 3), new Date(2026, 7, 5));
    expect(daily.map((item) => item.id)).toEqual(["event-1", "event-1::2026-08-04", "event-1::2026-08-05"]);

    const weekly = expandRecurringEvents([event("WEEKLY")], new Date(2026, 7, 10), new Date(2026, 7, 24));
    expect(weekly.map((item) => item.startDate.toISOString().slice(0, 10))).toEqual(["2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("skips months that do not contain the original day", () => {
    const monthly = expandRecurringEvents([event("MONTHLY", "2026-01-31")], new Date(2026, 0, 1), new Date(2026, 3, 30));
    expect(monthly.map((item) => item.startDate.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("validates recurrence input and resolves occurrence IDs", () => {
    expect(recurrencePattern("WEEKLY")).toBe("WEEKLY");
    expect(recurrencePattern("NONE")).toBeNull();
    expect(recurrencePattern("YEARLY")).toBeUndefined();
    expect(baseEventId("event-1::2026-08-10")).toBe("event-1");
  });
});
