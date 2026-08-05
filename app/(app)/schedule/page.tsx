"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { ScheduleAgendaView } from "@/components/calendar/ScheduleAgendaView";
import { ScheduleContextPanel, ScheduleEditorState } from "@/components/calendar/ScheduleContextPanel";
import { ScheduleMonthView } from "@/components/calendar/ScheduleMonthView";
import { ScheduleWeekView } from "@/components/calendar/ScheduleWeekView";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useEventSync } from "@/hooks/use-event-sync";
import { useIsMobile } from "@/components/layout/useIsMobile";
import {
  EventSource,
  ScheduleEvent,
  ScheduleEventInput,
  ScheduleView,
  addDays,
  dateKey,
  formatTime,
  parseDateKey,
  parseTime,
  rangeForView,
  sourceLabel,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const ALL_SOURCES: EventSource[] = ["personal", "classroom", "course"];
const VIEWS: Array<{ value: ScheduleView; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];

function normalizeEvent(event: Partial<ScheduleEvent> & Pick<ScheduleEvent, "id" | "title" | "startDate" | "isAllDay">): ScheduleEvent {
  return {
    ...event,
    description: event.description ?? null,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    color: event.color || "#FADA6D",
    source: event.source || (event.classroomId ? "classroom" : event.courseId ? "course" : "personal"),
    canEdit: event.canEdit ?? true,
  } as ScheduleEvent;
}

function viewTitle(view: ScheduleView, date: Date) {
  if (view === "month") return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "agenda") return `Next 30 days · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const end = addDays(date, 6 - (date.getDay() === 0 ? 6 : date.getDay() - 1));
  const start = addDays(end, -6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${end.getFullYear()}`;
}

export default function SchedulePage() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ScheduleView>("agenda");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [editor, setEditor] = useState<ScheduleEditorState | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState<Set<EventSource>>(() => new Set(ALL_SOURCES));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = isMobile ? "schedule-view-mobile" : "schedule-view-desktop";
    const stored = window.localStorage.getItem(key) as ScheduleView | null;
    setView(stored && VIEWS.some((item) => item.value === stored) ? stored : isMobile ? "agenda" : "week");
  }, [isMobile]);

  useEffect(() => {
    if (!filtersOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterMenuRef.current?.contains(event.target)) {
        setFiltersOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  const range = rangeForView(view, selectedDate);
  const rangeStart = dateKey(range.start);
  const rangeEnd = dateKey(range.end);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/user/events?from=${rangeStart}&to=${rangeEnd}&ts=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (!response.ok) throw new Error("Could not load this date range.");
      const data = await response.json();
      setEvents(data.map(normalizeEvent));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load your schedule.");
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const { triggerUpdate } = useEventSync(fetchEvents);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (!sources.has(event.source)) return false;
      return !query || event.title.toLowerCase().includes(query) || event.description?.toLowerCase().includes(query) || event.classroomName?.toLowerCase().includes(query);
    });
  }, [events, search, sources]);

  const changeView = (nextView: ScheduleView) => {
    setView(nextView);
    setSelectedEvent(null);
    setEditor(null);
    window.localStorage.setItem(isMobile ? "schedule-view-mobile" : "schedule-view-desktop", nextView);
  };

  const navigate = (direction: -1 | 1) => {
    const next = new Date(selectedDate);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    }
    else next.setDate(next.getDate() + direction * (view === "agenda" ? 30 : 7));
    setSelectedDate(next);
    setSelectedEvent(null);
    setEditor(null);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    setSelectedEvent(null);
    setEditor(null);
  };

  const startCreate = (date: Date, startTime?: string, endTime?: string) => {
    const now = new Date();
    let initialStart = startTime;
    let initialEnd = endTime;
    if (!initialStart) {
      const startMinutes = dateKey(date) === dateKey(now)
        ? Math.min(22 * 60, Math.ceil((parseTime(`${now.getHours()}:${now.getMinutes()}`) + 15) / 15) * 15)
        : 9 * 60;
      initialStart = formatTime(startMinutes);
      initialEnd = formatTime(startMinutes + 60);
    }
    setSelectedDate(date);
    setSelectedEvent(null);
    setEditor({ mode: "create", date, startTime: initialStart, endTime: initialEnd });
    if (isMobile) setMobilePanelOpen(true);
  };

  const selectEvent = (event: ScheduleEvent) => {
    setSelectedDate(parseDateKey(dateKey(event.startDate)));
    setSelectedEvent(event);
    setEditor(null);
    if (isMobile) setMobilePanelOpen(true);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setEditor(null);
    if (isMobile && view === "month") setMobilePanelOpen(true);
  };

  const closePanelState = () => {
    if (editor?.mode === "edit") {
      setEditor(null);
      return;
    }
    setEditor(null);
    setSelectedEvent(null);
  };

  const updateEventOptimistically = useCallback(async (event: ScheduleEvent, changes: Partial<ScheduleEvent>, successMessage?: string) => {
    const previous = events;
    const optimistic = { ...event, ...changes };
    setEvents((current) => current.map((item) => item.id === event.id ? optimistic : item));
    if (selectedEvent?.id === event.id) setSelectedEvent(optimistic);
    try {
      const response = await fetch("/api/user/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id, ...changes }),
      });
      if (!response.ok) throw new Error();
      const updated = normalizeEvent(await response.json());
      setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedEvent?.id === updated.id) setSelectedEvent(updated);
      if (successMessage) toast.success(successMessage);
      triggerUpdate();
      return updated;
    } catch {
      setEvents(previous);
      if (selectedEvent?.id === event.id) setSelectedEvent(event);
      toast.error("The event could not be updated. Your previous schedule was restored.");
      return null;
    }
  }, [events, selectedEvent, triggerUpdate]);

  const saveEvent = async (input: ScheduleEventInput) => {
    setSaving(true);
    const startDate = `${input.date}T00:00:00.000Z`;
    try {
      if (editor?.mode === "edit" && selectedEvent) {
        const updated = await updateEventOptimistically(selectedEvent, {
          title: input.title,
          description: input.description,
          startDate,
          endDate: startDate,
          startTime: input.startTime,
          endTime: input.endTime,
          isAllDay: input.isAllDay,
          color: input.color,
        }, "Event updated.");
        if (updated) {
          setSelectedEvent(updated);
          setSelectedDate(parseDateKey(input.date));
          setEditor(null);
        }
      } else {
        const response = await fetch("/api/user/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: input.title,
            description: input.description,
            startDate,
            endDate: startDate,
            startTime: input.startTime,
            endTime: input.endTime,
            isAllDay: input.isAllDay,
            color: input.color,
          }),
        });
        if (!response.ok) throw new Error();
        const created = normalizeEvent(await response.json());
        setEvents((current) => [...current, created]);
        setSelectedEvent(created);
        setSelectedDate(parseDateKey(input.date));
        setEditor(null);
        toast.success("Event added.");
        triggerUpdate();
      }
    } catch {
      toast.error("The event could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const previous = events;
    setEvents((current) => current.filter((event) => event.id !== deleteTarget.id));
    try {
      const response = await fetch(`/api/user/events?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Event deleted.");
      setDeleteTarget(null);
      setSelectedEvent(null);
      setEditor(null);
      if (isMobile) setMobilePanelOpen(false);
      triggerUpdate();
    } catch {
      setEvents(previous);
      toast.error("The event could not be deleted. Your schedule was restored.");
    } finally {
      setDeleting(false);
    }
  };

  const moveEvent = (event: ScheduleEvent, date: Date, startTime: string, endTime: string) => {
    const startDate = `${dateKey(date)}T00:00:00.000Z`;
    void updateEventOptimistically(event, { startDate, endDate: startDate, startTime, endTime }, "Event moved.");
  };

  const resizeEvent = (event: ScheduleEvent, endTime: string) => {
    void updateEventOptimistically(event, { endTime }, "Event duration updated.");
  };

  const panel = (
    <ScheduleContextPanel
      selectedDate={selectedDate}
      events={filteredEvents}
      selectedEvent={selectedEvent}
      editor={editor}
      saving={saving}
      deleting={deleting}
      onSelectEvent={selectEvent}
      onStartCreate={(date) => startCreate(date)}
      onStartEdit={(event) => setEditor({ mode: "edit", date: parseDateKey(dateKey(event.startDate)) })}
      onBack={closePanelState}
      onSave={saveEvent}
      onDelete={setDeleteTarget}
    />
  );

  return (
    <div className="schedule-ui min-h-full bg-[var(--schedule-canvas)] px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--schedule-text)] md:text-[42px]">Schedule</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-[var(--schedule-line)] bg-white p-1">
                {VIEWS.map((item) => (
                  <button key={item.value} type="button" onClick={() => changeView(item.value)} aria-pressed={view === item.value} className={cn("h-9 rounded-lg px-3 text-sm font-semibold text-[var(--schedule-text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]", view === item.value && "bg-[var(--schedule-accent)] text-[var(--schedule-text)]")}>
                    {item.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => startCreate(selectedDate)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--schedule-accent-hover)] bg-[var(--schedule-accent)] px-4 text-sm font-semibold text-[var(--schedule-text)] hover:bg-[var(--schedule-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">
                <CalendarPlus className="h-4 w-4" />New event
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--schedule-line)] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate(-1)} aria-label="Previous date range" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-line)] text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={goToToday} className="h-9 rounded-xl border border-[var(--schedule-line)] px-3 text-sm font-semibold text-[var(--schedule-text)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">Today</button>
              <button type="button" onClick={() => navigate(1)} aria-label="Next date range" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-line)] text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><ChevronRight className="h-4 w-4" /></button>
              <h2 className="ml-1 text-sm font-semibold text-[var(--schedule-text)] md:text-base">{viewTitle(view, selectedDate)}</h2>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <label className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--schedule-text-faint)]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" className="h-9 w-full rounded-xl border border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] pl-9 pr-3 text-sm text-[var(--schedule-text)] outline-none placeholder:text-[var(--schedule-text-faint)] focus:border-[var(--schedule-focus-border)] focus:ring-2 focus:ring-[var(--schedule-focus-ring)]" />
              </label>
              <div ref={filterMenuRef} className="relative">
                <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-haspopup="true" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--schedule-line)] px-3 text-sm font-semibold text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Sources</span></button>
                {filtersOpen && (
                  <div role="group" aria-label="Event sources" className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-[var(--schedule-line)] bg-white p-1.5 shadow-[0_10px_30px_rgba(32,35,31,0.12)]">
                    {ALL_SOURCES.map((source) => {
                      const checked = sources.has(source);
                      return (
                        <label key={source} className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--schedule-text-muted)] transition-colors hover:bg-[var(--schedule-surface-muted)]", checked && "text-[var(--schedule-text)]")}>
                          <input type="checkbox" checked={checked} onChange={() => setSources((current) => { const next = new Set(current); if (next.has(source)) next.delete(source); else next.add(source); return next; })} className="peer sr-only" />
                          <span aria-hidden="true" className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border bg-white transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--schedule-focus-border)] peer-focus-visible:ring-offset-1", checked ? "border-[var(--schedule-focus-border)] bg-[var(--schedule-accent)]" : "border-[var(--schedule-line-strong)]")}>
                            {checked && <Check className="h-3.5 w-3.5 stroke-[2.5] text-[var(--schedule-text)]" />}
                          </span>
                          <span>{sourceLabel(source)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[var(--schedule-line)] bg-white px-6 text-center">
            <p className="font-semibold text-[var(--schedule-text)]">Your schedule could not be loaded</p>
            <p className="mt-2 text-sm text-[var(--schedule-text-muted)]">{error}</p>
            <button type="button" onClick={() => void fetchEvents()} className="mt-5 h-10 rounded-xl bg-[var(--schedule-accent)] px-4 text-sm font-semibold text-[var(--schedule-text)]">Try again</button>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="h-[calc(100vh-208px)] min-h-[560px] min-w-0">
              {loading && events.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--schedule-line)] bg-white"><Spinner className="h-5 w-5 text-[var(--schedule-text-muted)]" /></div>
              ) : view === "week" ? (
                <ScheduleWeekView selectedDate={selectedDate} events={filteredEvents} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreateRange={startCreate} onMoveEvent={moveEvent} onResizeEvent={resizeEvent} />
              ) : view === "month" ? (
                <ScheduleMonthView selectedDate={selectedDate} events={filteredEvents} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreateDate={(date) => startCreate(date)} />
              ) : (
                <ScheduleAgendaView events={filteredEvents} selectedDate={selectedDate} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreateDate={(date) => startCreate(date)} />
              )}
            </main>
            <aside className="hidden h-[calc(100vh-208px)] min-h-[560px] overflow-hidden rounded-2xl border border-[var(--schedule-line)] bg-white lg:block">
              {panel}
            </aside>
          </div>
        )}
      </div>

      <Dialog open={mobilePanelOpen} onOpenChange={(open) => { setMobilePanelOpen(open); if (!open) closePanelState(); }}>
        <DialogContent className="schedule-dialog fixed bottom-0 left-0 top-auto block max-h-[88vh] min-h-[44vh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-3xl border border-[var(--schedule-line)] bg-white p-0 shadow-2xl md:hidden">
          <DialogTitle className="sr-only">Schedule details</DialogTitle>
          <DialogDescription className="sr-only">View or edit events for the selected date.</DialogDescription>
          <button type="button" onClick={() => setMobilePanelOpen(false)} aria-label="Close schedule details" className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--schedule-surface-muted)] text-[var(--schedule-text-muted)]"><X className="h-4 w-4" /></button>
          <div className="h-[min(78vh,720px)]">{panel}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="schedule-dialog rounded-2xl border border-[var(--schedule-line)] bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-[var(--schedule-text)]">Delete event?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--schedule-text-muted)]">“{deleteTarget?.title}” will be removed from your schedule. This action cannot be undone.</DialogDescription>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="h-10 rounded-xl border border-[var(--schedule-line)] px-4 text-sm font-semibold text-[var(--schedule-text)]">Cancel</button>
            <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="h-10 rounded-xl bg-[var(--schedule-danger)] px-4 text-sm font-semibold text-white disabled:opacity-60">{deleting ? "Deleting…" : "Delete event"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
