import { describe, expect, it } from "vitest";
import { parseEventReminder } from "./event-reminders";

const event = { id: "event-1", title: "Biology test", startDate: new Date("2099-08-09T00:00:00.000Z"), startTime: "12:00", isAllDay: false };

describe("parseEventReminder", () => {
  it("accepts a future reminder before the event", () => {
    const result = parseEventReminder({ timeZone: "UTC", notifyAt: "2099-08-09T10:00:00.000Z", eventStartsAt: "2099-08-09T12:00:00.000Z" }, event);
    expect(result).toHaveProperty("data");
  });

  it("rejects a reminder after the event", () => {
    const result = parseEventReminder({ timeZone: "UTC", notifyAt: "2099-08-09T13:00:00.000Z", eventStartsAt: "2099-08-09T12:00:00.000Z" }, event);
    expect(result).toEqual({ error: "Reminder time cannot be after the event starts" });
  });
});
