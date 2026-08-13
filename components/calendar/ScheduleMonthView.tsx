"use client";

import { CalendarPlus, LockKeyhole } from "lucide-react";
import type { CSSProperties } from "react";
import { ScheduleEvent, addDays, dateKey, eventsForDate, isSameDay, monthGridRange } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface ScheduleMonthViewProps {
  selectedDate: Date;
  events: ScheduleEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: ScheduleEvent) => void;
  onCreateDate: (date: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type EventSurfaceStyle = CSSProperties & { "--event-color": string };

export function ScheduleMonthView({ selectedDate, events, onSelectDate, onSelectEvent, onCreateDate }: ScheduleMonthViewProps) {
  const range = monthGridRange(selectedDate);
  const days = Array.from({ length: 42 }, (_, index) => addDays(range.start, index));
  const today = new Date();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--schedule-line)] bg-[var(--schedule-surface)]">
      <div className="grid grid-cols-7 border-b border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)]">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--schedule-text-muted)]">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const dayEvents = eventsForDate(events, day);
          const outside = day.getMonth() !== selectedDate.getMonth();
          const selected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <div
              key={dateKey(day)}
              className={cn(
                "group min-h-0 overflow-hidden border-b border-r border-[var(--schedule-line)] p-1 transition-colors",
                outside ? "bg-[var(--schedule-surface-muted)]/45" : "bg-[var(--schedule-surface)]",
                selected && "bg-[var(--schedule-accent)]/35",
              )}
            >
              <div className="mb-0.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  aria-label={`Select ${day.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]",
                    outside && "text-[var(--schedule-text-faint)]",
                    !outside && "text-[var(--schedule-text)]",
                    isToday && "bg-[var(--schedule-text)] text-[var(--app-text-inverse)]",
                  )}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={() => onCreateDate(day)}
                  aria-label={`New event on ${day.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--schedule-text-muted)] opacity-100 transition-colors hover:bg-[var(--schedule-accent)] hover:text-[var(--schedule-text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)] md:opacity-0 md:group-hover:opacity-100"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className="schedule-event-surface flex h-4 w-full items-center gap-1 truncate rounded-md border px-1.5 text-left text-[10px] font-semibold leading-none text-[var(--app-event-text)] shadow-[var(--app-shadow-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)] md:text-[11px]"
                    style={{ "--event-color": event.color || "var(--app-event-1)" } as EventSurfaceStyle}
                  >
                    {event.canEdit === false && <LockKeyhole className="h-2.5 w-2.5 shrink-0" />}
                    <span className="truncate">{event.isAllDay ? event.title : `${event.startTime || ""} ${event.title}`}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button type="button" onClick={() => onSelectDate(day)} className="px-1 text-[10px] font-semibold text-[var(--schedule-text-muted)] hover:text-[var(--schedule-text)]">
                    +{dayEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
