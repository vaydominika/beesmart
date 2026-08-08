import { describe, expect, it } from "vitest";
import { DeadlineValidationError, parseAssignmentDeadline } from "./assignment-deadline";

describe("assignment deadlines", () => {
    it("converts an explicit Budapest wall-clock time to UTC", () => {
        const deadline = parseAssignmentDeadline({ dueDate: "2026-08-06", dueTime: "14:30", timeZone: "Europe/Budapest" });
        expect(deadline.deadlineAt.toISOString()).toBe("2026-08-06T12:30:00.000Z");
        expect(deadline.deadlineHasTime).toBe(true);
        expect(deadline.deadlineTimeZone).toBe("Europe/Budapest");
    });

    it("uses the end of the assignment-local day when no time is supplied", () => {
        const deadline = parseAssignmentDeadline({ dueDate: "2026-08-06", dueTime: null, timeZone: "Europe/Budapest" });
        expect(deadline.deadlineAt.toISOString()).toBe("2026-08-06T21:59:59.000Z");
        expect(deadline.deadlineHasTime).toBe(false);
    });

    it("rejects a nonexistent daylight-saving wall-clock time", () => {
        expect(() => parseAssignmentDeadline({ dueDate: "2026-03-29", dueTime: "02:30", timeZone: "Europe/Budapest" }))
            .toThrow(DeadlineValidationError);
    });

    it("rejects invalid timezone identifiers", () => {
        expect(() => parseAssignmentDeadline({ dueDate: "2026-08-06", dueTime: "12:00", timeZone: "Bee/Hive" }))
            .toThrow("timezone is invalid");
    });
});
