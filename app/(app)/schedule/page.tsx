"use client";

import { useLocale } from "next-intl";

import { useText } from "@/i18n/use-text";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { ScheduleContextPanel, ScheduleEditorState } from "@/components/calendar/ScheduleContextPanel";
import { ScheduleMonthView } from "@/components/calendar/ScheduleMonthView";
import { ScheduleWeekView } from "@/components/calendar/ScheduleWeekView";
import { Dialog, DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceMultiSelect } from "@/components/ui/workspace-select";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { WorkspaceSearchField } from "@/components/ui/workspace-search-field";
import { LibraryToolbar, WorkspacePageFrame, WorkspacePageHeader } from "@/components/ui/workspace-page";
import { useEventSync } from "@/hooks/use-event-sync";
import { useIsMobile } from "@/components/layout/useIsMobile";
import {
  EventSource,
  ScheduleEvent,
  ScheduleEventInput,
  ScheduleView,
  addDays,
  dateKey,
  eventRecordId,
  formatTime,
  parseDateKey,
  parseTime,
  rangeForView,
  sourceLabel,
} from "@/lib/schedule";
import { toast } from "@/components/ui/sonner";
import { ClassroomWorkEditModal, classroomWorkDeleteEndpoint, classroomWorkKind, isClassroomWorkEvent } from "@/components/calendar/ClassroomWorkEditModal";
import { calendarEventColor } from "@/components/calendar/event-palette";

const ALL_SOURCES: EventSource[] = ["personal", "classroom"];
const SOURCE_OPTIONS = ALL_SOURCES.map((source) => ({ value: source, label: sourceLabel(source) }));
const VIEWS: Array<{ value: ScheduleView; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function normalizeEvent(event: Partial<ScheduleEvent> & Pick<ScheduleEvent, "id" | "title" | "startDate" | "isAllDay">): ScheduleEvent {
  const normalized = {
    ...event,
    description: event.description ?? null,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    source: event.source || (event.classroomId ? "classroom" : "personal"),
    canEdit: event.canEdit ?? true,
  } as ScheduleEvent;
  return { ...normalized, color: calendarEventColor(normalized) };
}

async function syncEventReminder(event: ScheduleEvent, reminder: ScheduleEventInput["reminder"]): Promise<ScheduleEvent> {
  const recordId = eventRecordId(event);
  if (!reminder) {
    if (!event.reminder) return event;
    const response = await fetch(`/api/user/events/${recordId}/reminder`, { method: "DELETE" });
    if (!response.ok) throw new Error("the reminder could not be removed");
    return { ...event, reminder: null };
  }

  const response = await fetch(`/api/user/events/${recordId}/reminder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reminder),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "the reminder could not be saved");
  return { ...event, reminder: data.reminder };
}

function viewTitle(view: ScheduleView, date: Date, locale: string) {
  if (view === "month") return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  if (locale === "hu") { const start = addDays(date, -(date.getDay() === 0 ? 6 : date.getDay() - 1)); return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).formatRange(start, addDays(start, 6)); }
  const end = addDays(date, 6 - (date.getDay() === 0 ? 6 : date.getDay() - 1));
  const start = addDays(end, -6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString(locale, { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString(locale, { month: "short", day: "numeric" })}–${end.toLocaleDateString(locale, { month: "short", day: "numeric" })}, ${end.getFullYear()}`;
}

export default function SchedulePage() {
  const locale = useLocale();
  const t = useText();
  const isMobile = useIsMobile();
  const [view, setView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null);
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
  const [workEditEvent, setWorkEditEvent] = useState<ScheduleEvent | null>(null);
  const fetchRequestRef = useRef(0);

  useEffect(() => {
    const key = isMobile ? "schedule-view-mobile" : "schedule-view-desktop";
    const stored = window.localStorage.getItem(key) as ScheduleView | null;
    setView(stored && VIEWS.some((item) => item.value === stored) ? stored : isMobile ? "month" : "week");
  }, [isMobile]);

  const range = rangeForView(view, selectedDate);
  const rangeStart = dateKey(range.start);
  const rangeEnd = dateKey(range.end);
  const rangeKey = `${view}:${rangeStart}:${rangeEnd}`;

  const fetchEvents = useCallback(async () => {
    const requestId = ++fetchRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/user/events?from=${rangeStart}&to=${rangeEnd}&ts=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (!response.ok) throw new Error(t("Could not load this date range."));
      const data = await response.json();
      if (requestId !== fetchRequestRef.current) return;
      const nextEvents = data.map(normalizeEvent) as ScheduleEvent[];
      const nextEventsById = new Map(nextEvents.map((event) => [event.id, event]));
      setEvents(nextEvents);
      setSelectedEvent((current) => current ? nextEventsById.get(current.id) ?? null : null);
      setDeleteTarget((current) => current ? nextEventsById.get(current.id) ?? null : null);
      setWorkEditEvent((current) => current ? nextEventsById.get(current.id) ?? null : null);
      setLoadedRangeKey(rangeKey);
    } catch (fetchError) {
      if (requestId !== fetchRequestRef.current) return;
      setError(fetchError instanceof Error ? fetchError.message : "Could not load your schedule.");
    } finally {
      if (requestId === fetchRequestRef.current) setLoading(false);
    }
  }, [rangeStart, rangeEnd, rangeKey, t]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const { triggerUpdate } = useEventSync(fetchEvents);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rangeEvents = loadedRangeKey === rangeKey ? events : [];
    return rangeEvents.filter((event) => {
      if (!sources.has(event.source)) return false;
      return !query || event.title.toLowerCase().includes(query) || event.description?.toLowerCase().includes(query) || event.classroomName?.toLowerCase().includes(query);
    });
  }, [events, loadedRangeKey, rangeKey, search, sources]);

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
    else next.setDate(next.getDate() + direction * 7);
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
    const recordId = eventRecordId(event);
    setEvents((current) => current.map((item) => eventRecordId(item) === recordId ? { ...item, ...changes } : item));
    if (selectedEvent?.id === event.id) setSelectedEvent(optimistic);
    try {
      const response = await fetch("/api/user/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, ...changes }),
      });
      if (!response.ok) throw new Error();
      const updated = normalizeEvent(await response.json());
      setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedEvent?.id === updated.id) setSelectedEvent(updated);
      if (successMessage) toast.success(t(successMessage));
      triggerUpdate();
      return updated;
    } catch {
      setEvents(previous);
      if (selectedEvent?.id === event.id) setSelectedEvent(event);
      toast.error(t("The event could not be updated. Your previous schedule was restored."));
      return null;
    }
  }, [events, selectedEvent, triggerUpdate, t]);

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
          recurrencePattern: input.recurrencePattern,
        });
        if (updated) {
          try {
            const eventWithReminder = await syncEventReminder(updated, input.reminder);
            setEvents((current) => current.map((event) => event.id === eventWithReminder.id ? eventWithReminder : event));
            setSelectedEvent(eventWithReminder);
            setSelectedDate(parseDateKey(input.date));
            setEditor(null);
            toast.success(t(input.reminder ? t("Event updated. Reminder set for {v0}.", { v0: new Date(input.reminder.notifyAt).toLocaleString(locale) }) : selectedEvent.reminder ? "Event updated. Reminder removed." : "Event updated."));
            triggerUpdate();
          } catch (reminderError) {
            toast.error(t("Event updated, but {v0}.", { v0: reminderError instanceof Error ? reminderError.message : t("the reminder could not be saved") }));
          }
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
            recurrencePattern: input.recurrencePattern,
          }),
        });
        if (!response.ok) throw new Error();
        let created = normalizeEvent(await response.json());
        setEvents((current) => [...current, created]);
        let reminderError: string | null = null;
        if (input.reminder) {
          try {
            created = await syncEventReminder(created, input.reminder);
            setEvents((current) => current.map((event) => event.id === created.id ? created : event));
          } catch (error) {
            reminderError = error instanceof Error ? error.message : "the reminder could not be saved";
          }
        }
        setSelectedEvent(created);
        setSelectedDate(parseDateKey(input.date));
        setEditor(null);
        if (reminderError) toast.error(t("Event added, but {v0}.", { v0: reminderError }));
        else if (input.reminder) toast.success(t("Event added. Reminder set for {v0}.", { v0: new Date(input.reminder.notifyAt).toLocaleString(locale) }));
        else toast.success(t("Event added."));
        triggerUpdate();
      }
    } catch {
      toast.error(t("The event could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const workKind = classroomWorkKind(deleteTarget);
    const recordId = eventRecordId(deleteTarget);
    const endpoint = classroomWorkDeleteEndpoint(deleteTarget) ?? `/api/user/events?id=${recordId}`;
    setDeleting(true);
    const previous = events;
    setEvents((current) => current.filter((event) => eventRecordId(event) !== recordId));
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("The {kind} could not be deleted.", { kind: t(workKind ?? "event") }));
      toast.success(t("{v0} deleted.", { v0: workKind ? t(workKind[0].toUpperCase() + workKind.slice(1)) : t("Event") }));
      setDeleteTarget(null);
      setSelectedEvent(null);
      setEditor(null);
      if (isMobile) setMobilePanelOpen(false);
      triggerUpdate();
    } catch (deleteError) {
      setEvents(previous);
      toast.error(t(deleteError instanceof Error ? deleteError.message : "The item could not be deleted. Your schedule was restored."));
    } finally {
      setDeleting(false);
    }
  };

  const moveEvent = (event: ScheduleEvent, date: Date, startTime: string, endTime: string) => {
    if (event.recurrencePattern) return;
    const startDate = `${dateKey(date)}T00:00:00.000Z`;
    void updateEventOptimistically(event, { startDate, endDate: startDate, startTime, endTime }, t("Event moved."));
  };

  const resizeEvent = (event: ScheduleEvent, endTime: string) => {
    if (event.recurrencePattern) return;
    void updateEventOptimistically(event, { endTime }, t("Event duration updated."));
  };

  const startEdit = (event: ScheduleEvent) => {
    if (isClassroomWorkEvent(event)) {
      setWorkEditEvent(event);
      return;
    }
    setEditor({ mode: "edit", date: parseDateKey(dateKey(event.startDate)) });
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
      onStartEdit={startEdit}
      onBack={closePanelState}
      onSave={saveEvent}
      onDelete={setDeleteTarget}
    />
  );

  return (
    <WorkspacePageFrame className="schedule-ui bg-[var(--schedule-canvas)]">
        <header className="schedule-page-header mb-5">
          <WorkspacePageHeader className="mb-0 sm:flex-col sm:items-stretch xl:flex-row xl:items-end" title={t("Schedule")} titleClassName="text-[var(--schedule-text)]" actions={<div className="flex flex-wrap items-center gap-2">
              <WorkspaceTabs ariaLabel={t("Schedule view")} items={VIEWS} value={view} onValueChange={changeView} />
              <WorkspaceButton type="button" variant="primary" onClick={() => startCreate(selectedDate)}>
                <CalendarPlus className="h-4 w-4" />{t("New event")} </WorkspaceButton>
            </div>} />

          <LibraryToolbar className="schedule-toolbar mt-5 border-[var(--schedule-line)]">
            <div className="flex items-center gap-2">
              <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => navigate(-1)} aria-label={t("Previous date range")}><ChevronLeft className="h-4 w-4" /></WorkspaceButton>
              <WorkspaceButton type="button" variant="secondary" onClick={goToToday}>{t("Today")}</WorkspaceButton>
              <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => navigate(1)} aria-label={t("Next date range")}><ChevronRight className="h-4 w-4" /></WorkspaceButton>
              <h2 className="ml-1 text-sm font-semibold text-[var(--schedule-text)] md:text-base">{viewTitle(view, selectedDate, locale)}</h2>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <WorkspaceSearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search events")} aria-label={t("Search events")} wrapperClassName="min-w-0 flex-1 lg:w-64 lg:flex-none" className="border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] text-[var(--schedule-text)] placeholder:text-[var(--schedule-text-faint)] focus:border-[var(--schedule-focus-border)] focus:ring-[var(--schedule-focus-ring)]" />
              <WorkspaceMultiSelect
                ariaLabel={t("Event sources")}
                label={t("Sources")}
                values={sources}
                options={SOURCE_OPTIONS} translateLabels
                triggerIcon={SlidersHorizontal}
                align="end"
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                onValueChange={(source, checked) => setSources((current) => {
                  const next = new Set(current);
                  if (checked) next.add(source);
                  else next.delete(source);
                  return next;
                })}
                contentClassName="w-48"
              />
            </div>
          </LibraryToolbar>
        </header>

        {error ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[var(--schedule-line)] bg-[var(--app-surface)] px-6 text-center">
            <p className="font-semibold text-[var(--schedule-text)]">{t("Your schedule could not be loaded")}</p>
            <p className="mt-2 text-sm text-[var(--schedule-text-muted)]">{t(error)}</p>
            <WorkspaceButton type="button" variant="primary" onClick={() => void fetchEvents()} className="mt-5">{t("Try again")}</WorkspaceButton>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="schedule-workspace-frame h-[calc(100vh-200px)] min-h-[560px] min-w-0">
              {loading && events.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--schedule-line)] bg-[var(--app-surface)]"><Spinner className="h-5 w-5 text-[var(--schedule-text-muted)]" /></div>
              ) : view === "week" ? (
                <ScheduleWeekView selectedDate={selectedDate} events={filteredEvents} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreateRange={startCreate} onMoveEvent={moveEvent} onResizeEvent={resizeEvent} />
              ) : (
                <ScheduleMonthView selectedDate={selectedDate} events={filteredEvents} onSelectDate={selectDate} onSelectEvent={selectEvent} onCreateDate={(date) => startCreate(date)} />
              )}
            </main>
            <aside className="schedule-workspace-frame hidden h-[calc(100vh-200px)] min-h-[560px] overflow-hidden rounded-2xl border border-[var(--schedule-line)] bg-[var(--app-surface)] lg:block">
              {panel}
            </aside>
          </div>
        )}
      <Dialog open={mobilePanelOpen} onOpenChange={(open) => { setMobilePanelOpen(open); if (!open) closePanelState(); }}>
        <WorkspaceDialogContent mobileSheet={false} className="schedule-dialog fixed bottom-0 left-0 top-auto block max-h-[88vh] min-h-[44vh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-3xl border border-[var(--schedule-line)] bg-[var(--app-surface)] p-0 shadow-2xl md:hidden">
          <DialogTitle className="sr-only">{t("Schedule details")}</DialogTitle>
          <DialogDescription className="sr-only">{t("View or edit events for the selected date.")}</DialogDescription>
          <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setMobilePanelOpen(false)} aria-label={t("Close schedule details")} className="absolute right-4 top-4 z-20"><X className="h-4 w-4" /></WorkspaceButton>
          <div className="h-[min(78vh,720px)]">{panel}</div>
        </WorkspaceDialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <WorkspaceDialogContent mobileSheet={false} className="schedule-dialog rounded-2xl border border-[var(--schedule-line)] bg-[var(--app-surface)] p-6 pr-14 shadow-xl">
          <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label={t("Close delete confirmation")} className="absolute right-4 top-4 z-20" disabled={deleting}><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
          <DialogTitle className="text-lg font-semibold text-[var(--schedule-text)]">{t("Delete")} {deleteTarget ? t(classroomWorkKind(deleteTarget) ?? "event") : t("event")}?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[var(--schedule-text-muted)]">{deleteTarget && classroomWorkKind(deleteTarget) ? t("“{v0}” and all of its submissions and grades will be removed from the Classroom. This action cannot be undone.", { v0: deleteTarget.title }) : deleteTarget?.recurrencePattern ? t("The entire “{v0}” series will be removed from your schedule. This action cannot be undone.", { v0: deleteTarget.title }) : t("“{v0}” will be removed from your schedule. This action cannot be undone.", { v0: deleteTarget?.title })}</DialogDescription>
          <div className="mt-2 flex justify-end gap-3">
            <WorkspaceButton type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("Cancel")}</WorkspaceButton>
            <WorkspaceButton type="button" variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? t("Deleting…") : t("Delete {v0}", { v0: deleteTarget ? t(classroomWorkKind(deleteTarget) ?? "event") : t("event") })}</WorkspaceButton>
          </div>
        </WorkspaceDialogContent>
      </Dialog>

      {workEditEvent && isClassroomWorkEvent(workEditEvent) ? (
        <ClassroomWorkEditModal
          open
          event={workEditEvent}
          onClose={() => setWorkEditEvent(null)}
          onUpdated={(updatedEvent) => {
            const normalized = normalizeEvent(updatedEvent);
            setEvents((current) => current.map((event) => event.id === normalized.id ? normalized : event));
            setSelectedEvent((current) => current?.id === normalized.id ? normalized : current);
            setSelectedDate(parseDateKey(dateKey(normalized.startDate)));
            triggerUpdate();
          }}
        />
      ) : null}
    </WorkspacePageFrame>
  );
}
