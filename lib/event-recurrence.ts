export type RecurringEventRecord = {
  id: string;
  startDate: Date;
  endDate: Date;
  recurrencePattern?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
};

function utcDay(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function rangeUtcDay(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function occurrenceId(id: string, date: Date, baseDate: Date) {
  if (date.getTime() === baseDate.getTime()) return id;
  return `${id}::${date.toISOString().slice(0, 10)}`;
}

function firstSteppedOccurrence(base: Date, rangeStart: Date, stepDays: number) {
  if (base >= rangeStart) return base;
  const elapsedDays = Math.floor((rangeStart.getTime() - base.getTime()) / 86_400_000);
  return addUtcDays(base, Math.ceil(elapsedDays / stepDays) * stepDays);
}

function monthlyOccurrences(base: Date, rangeStart: Date, rangeEnd: Date) {
  const dates: Date[] = [];
  const day = base.getUTCDate();
  let year = rangeStart.getUTCFullYear();
  let month = rangeStart.getUTCMonth();
  while (year < rangeEnd.getUTCFullYear() || (year === rangeEnd.getUTCFullYear() && month <= rangeEnd.getUTCMonth())) {
    const candidate = new Date(Date.UTC(year, month, day));
    if (candidate.getUTCMonth() === month && candidate >= base && candidate >= rangeStart && candidate <= rangeEnd) {
      dates.push(candidate);
    }
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return dates;
}

export function expandRecurringEvents<T extends RecurringEventRecord>(events: T[], rangeStartValue: Date, rangeEndValue: Date) {
  const rangeStart = rangeUtcDay(rangeStartValue);
  const rangeEnd = rangeUtcDay(rangeEndValue);
  const expanded: Array<T & { seriesId?: string; seriesStartDate?: Date }> = [];

  for (const event of events) {
    const baseStart = utcDay(event.startDate);
    const baseEnd = utcDay(event.endDate);
    const durationDays = Math.max(0, Math.round((baseEnd.getTime() - baseStart.getTime()) / 86_400_000));
    if (!event.recurrencePattern) {
      if (baseStart >= rangeStart && baseStart <= rangeEnd) expanded.push(event);
      continue;
    }

    const occurrenceDates = event.recurrencePattern === "MONTHLY"
      ? monthlyOccurrences(baseStart, rangeStart, rangeEnd)
      : (() => {
          const stepDays = event.recurrencePattern === "DAILY" ? 1 : 7;
          const dates: Date[] = [];
          for (let current = firstSteppedOccurrence(baseStart, rangeStart, stepDays); current <= rangeEnd; current = addUtcDays(current, stepDays)) {
            dates.push(current);
          }
          return dates;
        })();

    for (const occurrenceStart of occurrenceDates) {
      expanded.push({
        ...event,
        id: occurrenceId(event.id, occurrenceStart, baseStart),
        startDate: occurrenceStart,
        endDate: addUtcDays(occurrenceStart, durationDays),
        seriesId: event.id,
        seriesStartDate: event.startDate,
      });
    }
  }

  return expanded.sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
}

export function recurrencePattern(value: unknown): "DAILY" | "WEEKLY" | "MONTHLY" | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "NONE") return null;
  if (value === "DAILY" || value === "WEEKLY" || value === "MONTHLY") return value;
  return undefined;
}

export function baseEventId(value: string) {
  return value.split("::", 1)[0];
}
