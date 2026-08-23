export class ScheduleValidationError extends Error {}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTimeInputValue(date = new Date()) {
  return `${localDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localTimeInputValue(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function minimumLocalDateTimeInputValue(now = new Date()) {
  const minimum = new Date(now);
  if (minimum.getSeconds() > 0 || minimum.getMilliseconds() > 0) minimum.setMinutes(minimum.getMinutes() + 1);
  minimum.setSeconds(0, 0);
  return localDateTimeInputValue(minimum);
}

export function minimumLocalTimeInputValue(now = new Date()) {
  return minimumLocalDateTimeInputValue(now).slice(11);
}

export function isLocalDateTimePast(value: string, now = new Date()) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < now.getTime();
}

export function assertDeadlineNotPast(deadline: Date, label: string, now = new Date()) {
  if (Number.isNaN(deadline.getTime())) throw new ScheduleValidationError(`${label} is invalid`);
  if (deadline.getTime() < now.getTime()) throw new ScheduleValidationError(`${label} cannot be in the past`);
}

export function parseScheduleDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ScheduleValidationError(`${label} is invalid`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ScheduleValidationError(`${label} is invalid`);
  return parsed;
}

export function parseNewTestSchedule(opensAt: unknown, closesAt: unknown, now = new Date()) {
  if (closesAt && !opensAt) throw new ScheduleValidationError("Opening date required");
  const opening = parseScheduleDate(opensAt, "Opening time");
  const closing = parseScheduleDate(closesAt, "Closing time");
  if (opening) assertDeadlineNotPast(opening, "Opening time", now);
  if (closing) assertDeadlineNotPast(closing, "Closing time", now);
  if (opening && closing && closing < opening) {
    throw new ScheduleValidationError("Closing time must be after opening time");
  }
  return { opensAt: opening, closesAt: closing };
}
