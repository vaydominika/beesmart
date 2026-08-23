import { describe, expect, it } from "vitest";
import {
  ScheduleValidationError,
  assertDeadlineNotPast,
  localDateInputValue,
  localDateTimeInputValue,
  localTimeInputValue,
  minimumLocalDateTimeInputValue,
  minimumLocalTimeInputValue,
  parseNewTestSchedule,
} from "./schedule-validation";

const now = new Date(2026, 7, 23, 14, 30);

describe("schedule validation", () => {
  it("creates local HTML date values without UTC shifting", () => {
    expect(localDateInputValue(now)).toBe("2026-08-23");
    expect(localDateTimeInputValue(now)).toBe("2026-08-23T14:30");
    expect(localTimeInputValue(now)).toBe("14:30");
    expect(minimumLocalDateTimeInputValue(new Date(2026, 7, 23, 14, 30, 1))).toBe("2026-08-23T14:31");
    expect(minimumLocalTimeInputValue(new Date(2026, 7, 23, 14, 30, 1))).toBe("14:31");
  });

  it("rejects assignment deadlines in the past", () => {
    expect(() => assertDeadlineNotPast(new Date(now.getTime() - 1), "Assignment deadline", now))
      .toThrow("Assignment deadline cannot be in the past");
  });

  it("rejects past test schedules and invalid ordering", () => {
    expect(() => parseNewTestSchedule("2026-08-22T10:00", null, now)).toThrow(ScheduleValidationError);
    expect(() => parseNewTestSchedule("not-a-date", null, now)).toThrow("Opening time is invalid");
    expect(() => parseNewTestSchedule("2026-08-24T10:00", "2026-08-24T09:00", now))
      .toThrow("Closing time must be after opening time");
  });

  it("accepts a future test schedule", () => {
    const schedule = parseNewTestSchedule("2026-08-24T10:00", "2026-08-24T11:00", now);
    expect(schedule.opensAt).toEqual(new Date("2026-08-24T10:00"));
    expect(schedule.closesAt).toEqual(new Date("2026-08-24T11:00"));
  });
});
