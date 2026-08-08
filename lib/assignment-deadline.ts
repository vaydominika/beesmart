export class DeadlineValidationError extends Error {}

type DeadlineInput = {
    dueDate: unknown;
    dueTime?: unknown;
    timeZone: unknown;
};

type DateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

function zonedParts(date: Date, timeZone: string): DateParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
    );
    return parts as DateParts;
}

function sameParts(left: DateParts, right: DateParts) {
    return left.year === right.year
        && left.month === right.month
        && left.day === right.day
        && left.hour === right.hour
        && left.minute === right.minute
        && left.second === right.second;
}

function offsetAt(date: Date, timeZone: string) {
    const parts = zonedParts(date, timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

export function parseAssignmentDeadline(input: DeadlineInput) {
    if (typeof input.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
        throw new DeadlineValidationError("A valid due date is required");
    }
    if (typeof input.timeZone !== "string" || !input.timeZone.trim()) {
        throw new DeadlineValidationError("A valid timezone is required");
    }

    const timeZone = input.timeZone.trim();
    try {
        new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
        throw new DeadlineValidationError("The assignment timezone is invalid");
    }

    const deadlineHasTime = typeof input.dueTime === "string" && input.dueTime.trim().length > 0;
    const time = deadlineHasTime ? String(input.dueTime) : "23:59:59";
    if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) {
        throw new DeadlineValidationError("The due time must use HH:mm format");
    }

    const [year, month, day] = input.dueDate.split("-").map(Number);
    const [hour, minute, second = 0] = time.split(":").map(Number);
    const desired = { year, month, day, hour, minute, second };
    const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const wallClockDate = new Date(wallClockUtc);

    if (
        wallClockDate.getUTCFullYear() !== year
        || wallClockDate.getUTCMonth() !== month - 1
        || wallClockDate.getUTCDate() !== day
        || hour > 23
        || minute > 59
        || second > 59
    ) {
        throw new DeadlineValidationError("The assignment deadline is not a valid date and time");
    }

    let deadlineAt = new Date(wallClockUtc - offsetAt(wallClockDate, timeZone));
    deadlineAt = new Date(wallClockUtc - offsetAt(deadlineAt, timeZone));
    if (!sameParts(zonedParts(deadlineAt, timeZone), desired)) {
        throw new DeadlineValidationError("That local time does not exist because of a daylight-saving change");
    }

    return { deadlineAt, deadlineTimeZone: timeZone, deadlineHasTime };
}
