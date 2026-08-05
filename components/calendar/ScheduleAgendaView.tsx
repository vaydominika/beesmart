"use client";

import { BookOpen, CalendarDays, CalendarPlus, Clock3, LockKeyhole, School, UserRound } from "lucide-react";
import { ScheduleEvent, dateKey, eventSourceLabel, parseDateKey } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface ScheduleAgendaViewProps {
  events: ScheduleEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: ScheduleEvent) => void;
  onCreateDate: (date: Date) => void;
}

function SourceIcon({ event }: { event: ScheduleEvent }) {
  if (event.source === "classroom") return <School className="h-3.5 w-3.5" />;
  if (event.source === "course") return <BookOpen className="h-3.5 w-3.5" />;
  return <UserRound className="h-3.5 w-3.5" />;
}

export function ScheduleAgendaView({ events, onSelectDate, onSelectEvent, onCreateDate }: ScheduleAgendaViewProps) {
  const groups = events.reduce<Map<string, ScheduleEvent[]>>((map, event) => {
    const key = dateKey(event.startDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
    return map;
  }, new Map());
  const now = new Date();
  const nextEvent = events.find((event) => {
    const eventDate = parseDateKey(dateKey(event.startDate));
    if (event.isAllDay) return eventDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    eventDate.setHours(Number(event.startTime?.slice(0, 2) || 0), Number(event.startTime?.slice(3, 5) || 0));
    return eventDate >= now;
  });

  if (groups.size === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-[var(--schedule-line)] bg-[var(--schedule-surface)] px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--schedule-accent)] text-[var(--schedule-accent-text)]">
          <CalendarDays className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--schedule-text)]">Your next 30 days are clear</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--schedule-text-muted)]">No upcoming lessons, deadlines, or study sessions.</p>
      </div>
    );
  }

  return (
    <div className="schedule-scroll h-full min-h-0 space-y-4 overflow-y-auto pr-1">
      {Array.from(groups.entries()).map(([key, dayEvents]) => {
        const date = parseDateKey(key);
        return (
          <section key={key} className="overflow-hidden rounded-2xl border border-[var(--schedule-line)] bg-[var(--schedule-surface)]">
            <header className="flex items-center justify-between border-b border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] px-4 py-3">
              <button type="button" onClick={() => onSelectDate(date)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">
                <span className="block text-sm font-semibold text-[var(--schedule-text)]">{date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                <span className="text-xs text-[var(--schedule-text-muted)]">{dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}</span>
              </button>
              <button type="button" onClick={() => onCreateDate(date)} aria-label={`New event on ${key}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-line)] bg-white text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-accent)] hover:text-[var(--schedule-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">
                <CalendarPlus className="h-4 w-4" />
              </button>
            </header>
            <div className="divide-y divide-[var(--schedule-line)]">
              {dayEvents.map((event) => {
                const isNext = nextEvent?.id === event.id;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className={cn("group relative flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-[var(--schedule-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--schedule-focus-border)]", isNext && "bg-[var(--schedule-accent)]/20 ring-1 ring-inset ring-[var(--schedule-focus-border)]/30")}
                  >
                    <div className="w-16 shrink-0 font-mono text-xs font-semibold text-[var(--schedule-text-muted)]">
                      {event.isAllDay ? "All day" : event.startTime || "—"}
                    </div>
                    <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: event.color || "var(--schedule-accent)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--schedule-text)]">{event.title}</span>
                        {isNext && <span className="rounded-full bg-[#d2bc4a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">Next up</span>}
                        {event.canEdit === false && <LockKeyhole className="h-3.5 w-3.5 text-[var(--schedule-text-faint)]" />}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--schedule-text-muted)]">
                        <span className="flex items-center gap-1"><SourceIcon event={event} />{eventSourceLabel(event)}</span>
                        {!event.isAllDay && event.endTime && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Until {event.endTime}</span>}
                      </div>
                      {event.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--schedule-text-muted)]">{event.description}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
