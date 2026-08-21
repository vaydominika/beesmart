"use client";

import { useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
  HOUR_HEIGHT,
  MINUTES_PER_STEP,
  ScheduleEvent,
  type ScheduleSelectionProps,
  addDays,
  dateKey,
  eventDuration,
  eventsForDate,
  formatTime,
  getNowMinutes,
  isSameDay,
  parseTime,
  snapMinutes,
  startOfWeek,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { eventSurfaceStyle } from "./event-palette";

interface ScheduleWeekViewProps extends ScheduleSelectionProps {
  selectedDate: Date;
  events: ScheduleEvent[];
  onSelectDate: (date: Date) => void;
  onCreateRange: (date: Date, startTime: string, endTime: string) => void;
  onMoveEvent: (event: ScheduleEvent, date: Date, startTime: string, endTime: string) => void;
  onResizeEvent: (event: ScheduleEvent, endTime: string) => void;
}

interface SelectionState {
  date: Date;
  startY: number;
  currentY: number;
}

interface ResizeState {
  event: ScheduleEvent;
  startClientY: number;
  initialDuration: number;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LAPTOP_HOUR_HEIGHT = 52;

function shouldUseCompactWeekGrid() {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 1024 && window.innerHeight <= 820;
}

export function ScheduleWeekView({
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
  onCreateRange,
  onMoveEvent,
  onResizeEvent,
}: ScheduleWeekViewProps) {
  const weekStart = startOfWeek(selectedDate);
  const weekStartKey = dateKey(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrolledWeek = useRef<string | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [resizePreview, setResizePreview] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateGridDensity = () => setHourHeight(shouldUseCompactWeekGrid() ? LAPTOP_HOUR_HEIGHT : HOUR_HEIGHT);

    updateGridDensity();
    window.addEventListener("resize", updateGridDensity);
    return () => window.removeEventListener("resize", updateGridDensity);
  }, []);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || lastScrolledWeek.current === weekStartKey) return;
    const timedEvents = events.filter((event) => !event.isAllDay && event.startTime);
    const firstEventMinutes = timedEvents.length
      ? Math.min(...timedEvents.map((event) => parseTime(event.startTime)))
      : Number.POSITIVE_INFINITY;
    const target = isSameDay(now, selectedDate)
      ? Math.min(getNowMinutes(now), firstEventMinutes)
      : Math.min(7 * 60, firstEventMinutes);
    viewport.scrollTop = Math.max(0, (Math.max(0, target - 60) / 60) * hourHeight);
    lastScrolledWeek.current = weekStartKey;
  }, [events, hourHeight, now, selectedDate, weekStartKey]);

  useEffect(() => {
    if (!resize) return;

    const handleMove = (event: PointerEvent) => {
      const deltaMinutes = snapMinutes(((event.clientY - resize.startClientY) / hourHeight) * 60);
      setResizePreview(Math.max(MINUTES_PER_STEP, resize.initialDuration + deltaMinutes));
    };
    const handleUp = () => {
      const duration = resizePreview ?? resize.initialDuration;
      const endTime = formatTime(parseTime(resize.event.startTime) + duration);
      onResizeEvent(resize.event, endTime);
      setResize(null);
      setResizePreview(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [hourHeight, resize, resizePreview, onResizeEvent]);

  const minutesFromY = (y: number) => Math.max(0, Math.min(23 * 60 + 45, snapMinutes((y / hourHeight) * 60)));

  const finishSelection = () => {
    if (!selection) return;
    const start = minutesFromY(Math.min(selection.startY, selection.currentY));
    let end = minutesFromY(Math.max(selection.startY, selection.currentY));
    if (end - start < MINUTES_PER_STEP) end = Math.min(24 * 60 - 1, start + 60);
    onCreateRange(selection.date, formatTime(start), formatTime(end));
    setSelection(null);
  };

  const eventPosition = (event: ScheduleEvent) => {
    const start = parseTime(event.startTime);
    const duration = resize?.event.id === event.id && resizePreview !== null
      ? resizePreview
      : eventDuration(event);
    return {
      top: `${(start / 60) * hourHeight}px`,
      height: `${Math.max(32, (duration / 60) * hourHeight)}px`,
    };
  };

  return (
    <div className="schedule-week-view h-full min-h-[520px] overflow-hidden rounded-2xl border border-[var(--schedule-line)] bg-[var(--schedule-surface)]">
      <div ref={scrollRef} className="schedule-scroll h-full overflow-auto" onPointerUp={finishSelection}>
        <div className="min-w-[980px] md:min-w-[680px]">
          <div className="sticky top-0 z-30 bg-[var(--schedule-surface)] shadow-[0_1px_0_var(--schedule-line)]">
            <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, minmax(88px, 1fr))" }}>
              <div className="border-r border-[var(--schedule-line)]" />
              {weekDays.map((day) => {
                const today = isSameDay(day, now);
                const selected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    onClick={() => onSelectDate(day)}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center border-r border-[var(--schedule-line)] px-2 py-2 text-center last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--schedule-focus-border)]",
                      selected && "bg-[var(--schedule-accent)]",
                    )}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--schedule-text-muted)]">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className={cn(
                      "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-[var(--schedule-text)]",
                      today && "bg-[var(--schedule-text)] text-[var(--app-text-inverse)]",
                    )}>
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid border-t border-[var(--schedule-line)]" style={{ gridTemplateColumns: "64px repeat(7, minmax(88px, 1fr))" }}>
              <div className="flex min-h-11 items-center justify-end border-r border-[var(--schedule-line)] px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--schedule-text-faint)]">
                All day
              </div>
              {weekDays.map((day) => (
                <div key={dateKey(day)} className="min-h-11 border-r border-[var(--schedule-line)] p-1 last:border-r-0">
                  <div className="space-y-1">
                    {eventsForDate(events, day).filter((event) => event.isAllDay).slice(0, 2).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        className="schedule-event-surface flex w-full items-center gap-1 truncate rounded-md border px-2 py-1 text-left text-[11px] font-semibold text-[var(--app-event-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"
                        style={eventSurfaceStyle(event.color)}
                      >
                        {event.canEdit === false && <LockKeyhole className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{event.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, minmax(88px, 1fr))" }}>
            <div className="sticky left-0 z-20 border-r border-[var(--schedule-line)] bg-[var(--schedule-surface)]">
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-[var(--schedule-line)] pr-2 pt-1 text-right font-mono text-[10px] text-[var(--schedule-text-faint)]" style={{ height: hourHeight }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayEvents = eventsForDate(events, day).filter((event) => !event.isAllDay && event.startTime);
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={dateKey(day)}
                  className={cn("relative border-r border-[var(--schedule-line)] last:border-r-0", isToday && "bg-[var(--schedule-today)]")}
                  style={{ height: HOURS.length * hourHeight }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-event-card]")) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const y = event.clientY - rect.top;
                    setSelection({ date: day, startY: y, currentY: y });
                    onSelectDate(day);
                  }}
                  onPointerMove={(event) => {
                    if (!selection || !isSameDay(selection.date, day)) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setSelection((current) => current ? { ...current, currentY: event.clientY - rect.top } : null);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/schedule-event");
                    const moved = events.find((item) => item.id === id);
                    if (!moved || moved.canEdit === false || !moved.startTime) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const start = minutesFromY(event.clientY - rect.top);
                    onMoveEvent(moved, day, formatTime(start), formatTime(Math.min(23 * 60 + 59, start + eventDuration(moved))));
                  }}
                >
                  {HOURS.map((hour) => <div key={hour} className="border-b border-[var(--schedule-line)]" style={{ height: hourHeight }} />)}

                  {isToday && (
                    <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-[var(--app-focus-border)]" style={{ top: (getNowMinutes(now) / 60) * hourHeight }}>
                      <span className="absolute -left-1 -top-[10px] flex h-5 min-w-[38px] items-center justify-center rounded-md border border-[var(--app-focus-border)] bg-[var(--app-accent-text)] px-2 font-mono text-[10px] font-bold leading-none text-[var(--app-text-inverse)] shadow-[var(--app-shadow-subtle)]">Now</span>
                    </div>
                  )}

                  {selection && isSameDay(selection.date, day) && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 z-20 rounded-lg border border-[var(--schedule-focus-border)] bg-[var(--schedule-accent)]/70"
                      style={{
                        top: Math.min(selection.startY, selection.currentY),
                        height: Math.max(18, Math.abs(selection.currentY - selection.startY)),
                      }}
                    />
                  )}

                  {dayEvents.map((event) => {
                    const isRoomy = eventDuration(event) >= 45;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        data-event-card
                        draggable={event.canEdit !== false}
                        onDragStart={(dragEvent) => dragEvent.dataTransfer.setData("text/schedule-event", event.id)}
                        onClick={() => onSelectEvent(event)}
                        aria-label={`${event.title}, ${event.startTime} to ${event.endTime || formatTime(parseTime(event.startTime) + 60)}`}
                        className={cn(
                          "schedule-event-card schedule-event-surface group absolute left-1 right-1 z-20 flex flex-col items-stretch justify-start overflow-hidden rounded-[10px] border text-left text-[var(--app-event-text)] shadow-[var(--app-shadow-subtle)] transition-[filter,transform,box-shadow] hover:-translate-y-px hover:brightness-[0.99] hover:shadow-[var(--app-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]",
                          isRoomy ? "px-2.5 py-2" : "px-2 py-[3px]",
                        )}
                        style={{ ...eventPosition(event), ...eventSurfaceStyle(event.color) }}
                      >
                        <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-[12px]">
                          {event.canEdit === false && <LockKeyhole className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{event.title}</span>
                        </span>
                        <span className={cn(
                          "block max-w-full truncate font-mono text-[9px] leading-[12px] text-[var(--app-text-muted)]",
                          isRoomy ? "mt-1 w-fit rounded-md bg-[color-mix(in_srgb,var(--app-surface)_55%,transparent)] px-1.5 py-0.5" : "mt-px",
                        )}>
                          {event.startTime}<span className="schedule-event-end-time"> – {event.endTime || formatTime(parseTime(event.startTime) + 60)}</span>
                        </span>
                        {event.canEdit !== false && (
                          <span
                            role="presentation"
                            aria-hidden="true"
                            className={cn(
                              "absolute bottom-0 left-0 right-0 flex h-4 cursor-ns-resize items-end justify-center pb-1 transition-opacity",
                              isRoomy ? "opacity-35 group-hover:opacity-70" : "opacity-0 group-hover:opacity-70",
                            )}
                            onPointerDown={(pointerEvent) => {
                              pointerEvent.preventDefault();
                              pointerEvent.stopPropagation();
                              setResize({ event, startClientY: pointerEvent.clientY, initialDuration: eventDuration(event) });
                            }}
                          >
                            <span className="h-0.5 w-7 rounded-full bg-[var(--app-event-text)]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
