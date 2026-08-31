"use client";

import { useCallback, useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { CalendarPlus, Clock, GripVertical, LockKeyhole, Repeat2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect } from "@/components/ui/workspace-select";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { cn } from "@/lib/utils";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { DEFAULT_EVENT_COLOR } from "./event-palette";
import { EventColorPicker } from "./EventColorPicker";
import { WorkspaceSwitchRow } from "@/components/ui/workspace-switch-row";
import { readJsonSafely } from "@/lib/http";
import { eventRecordId, formatLongDate, RECURRENCE_OPTIONS, type RecurrencePattern, type RecurrenceSelection } from "@/lib/schedule";

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  isProtected?: boolean;
  canEdit?: boolean;
  recurrencePattern?: RecurrencePattern | null;
  seriesId?: string | null;
}

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  onEventsChanged: () => void;
  initialStartTime?: string;
  initialEndTime?: string;
}

function SortableEventItem({ event, onDelete, onDragEnd }: { event: EventData; onDelete: (id: string) => void; onDragEnd: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={event} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="mb-2 flex items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2.5">
      {event.isProtected || event.recurrencePattern ? (
        <span className="flex h-8 w-8 items-center justify-center text-[var(--app-text-faint)]">{event.recurrencePattern ? <Repeat2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}</span>
      ) : (
        <button type="button" aria-label={`Reorder ${event.title}`} className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--app-text-faint)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] active:cursor-grabbing" onPointerDown={(pointerEvent) => controls.start(pointerEvent)}><GripVertical className="h-4 w-4" /></button>
      )}
      <div className="min-w-0 flex-1 px-2">
        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{event.title}</p>
        <p className="text-xs text-[var(--app-text-muted)]">{event.isAllDay ? "All day" : event.startTime ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : "No time set"}</p>
      </div>
      {event.canEdit !== false ? <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => onDelete(event.id)} aria-label={`Delete ${event.title}`}><Trash2 className="h-4 w-4" /></WorkspaceButton> : null}
    </Reorder.Item>
  );
}

export function EventModal({ open, onClose, selectedDate, onEventsChanged, initialStartTime, initialEndTime }: EventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [color, setColor] = useState<string>(DEFAULT_EVENT_COLOR);
  const [recurrence, setRecurrence] = useState<RecurrenceSelection>("NONE");
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dateStr = formatLongDate(selectedDate);

  const fetchEventsForDate = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const response = await fetch(`/api/user/events?month=${year}-${month}`);
      if (!response.ok) return;
      const allEvents: EventData[] = await response.json();
      const day = `${year}-${month}-${String(selectedDate.getDate()).padStart(2, "0")}`;
      setEvents(allEvents.filter((event) => event.startDate.slice(0, 10) === day));
    } finally {
      setLoadingEvents(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;
    void fetchEventsForDate();
    setTitle("");
    setDescription("");
    setStartTime(initialStartTime || "");
    setEndTime(initialEndTime || "");
    setIsAllDay(false);
    setColor(DEFAULT_EVENT_COLOR);
    setRecurrence("NONE");
  }, [fetchEventsForDate, initialEndTime, initialStartTime, open]);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Please enter a title.");
    if (!isAllDay && startTime && endTime && endTime <= startTime) return toast.error("End time must be later than start time.");
    setSaving(true);
    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const response = await fetch("/api/user/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: description.trim() || null, startDate: `${year}-${month}-${day}T00:00:00.000Z`, startTime: isAllDay ? null : startTime || null, endTime: isAllDay ? null : endTime || null, isAllDay, color, recurrencePattern: recurrence === "NONE" ? null : recurrence }) });
      if (!response.ok) {
        const result = await readJsonSafely<{ error?: string }>(response, {});
        return toast.error(result.error ?? "Failed to create event.");
      }
      toast.success("Event created");
      setTitle(""); setDescription(""); setStartTime(""); setEndTime(""); setIsAllDay(false); setColor(DEFAULT_EVENT_COLOR); setRecurrence("NONE");
      await fetchEventsForDate();
      window.setTimeout(onEventsChanged, 100);
    } catch {
      toast.error("Failed to create event.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!eventToDeleteId) return;
    setDeleting(true);
    try {
      const selected = events.find((event) => event.id === eventToDeleteId);
      const response = await fetch(`/api/user/events?id=${selected ? eventRecordId(selected) : eventToDeleteId}`, { method: "DELETE" });
      if (!response.ok) return toast.error("Failed to delete event.");
      toast.success("Event deleted");
      await fetchEventsForDate();
      window.setTimeout(onEventsChanged, 50);
      setShowDeleteModal(false);
      setEventToDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDragEnd = async () => {
    try {
      await fetch("/api/user/events", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(events.filter((event) => !event.isProtected && !event.recurrencePattern).map((event, index) => ({ id: event.id, order: index }))) });
      window.setTimeout(onEventsChanged, 50);
    } catch {
      toast.error("Failed to save order.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent className="h-[min(820px,92vh)] max-w-xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5" />Add event</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>{dateStr}</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="space-y-6">
          <section aria-labelledby="day-events-heading">
            <div className="mb-2 flex items-center justify-between"><h3 id="day-events-heading" className="text-sm font-semibold text-[var(--app-text)]">Events on this day</h3><span className="text-xs text-[var(--app-text-faint)]">Drag to reorder</span></div>
            {loadingEvents ? <p className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-4 text-sm text-[var(--app-text-muted)]">Loading events…</p> : events.length ? <Reorder.Group axis="y" layoutScroll values={events} onReorder={setEvents} className="max-h-44 overflow-y-auto pr-1">{events.map((event) => <SortableEventItem key={event.id} event={event} onDelete={(id) => { setEventToDeleteId(id); setShowDeleteModal(true); }} onDragEnd={handleDragEnd} />)}</Reorder.Group> : <p className="rounded-xl border border-dashed border-[var(--app-border-strong)] px-3 py-4 text-sm text-[var(--app-text-muted)]">No events yet. Add the first one below.</p>}
          </section>

          <section aria-labelledby="new-event-heading" className="space-y-4 border-t border-[var(--app-border)] pt-5">
            <h3 id="new-event-heading" className="text-sm font-semibold text-[var(--app-text)]">New event details</h3>
            <div><label htmlFor="event-title" className={workspaceLabelClass}>Title</label><Input id="event-title" value={title} onChange={(event) => setTitle(event.target.value)} className={workspaceFieldClass} placeholder="Event title" /></div>
            <div><label htmlFor="event-description" className={workspaceLabelClass}>Description <span className="font-normal text-[var(--app-text-faint)]">Optional</span></label><textarea id="event-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`${workspaceFieldClass} h-auto min-h-20 w-full resize-y py-2.5`} placeholder="Add a note" /></div>
            <div><label className={workspaceLabelClass}>Repeats</label><WorkspaceSelect ariaLabel="Repeats" value={recurrence} options={RECURRENCE_OPTIONS} onValueChange={setRecurrence} triggerIcon={Repeat2} className="w-full" /></div>
            <WorkspaceSwitchRow id="event-all-day" label="All day" checked={isAllDay} onCheckedChange={setIsAllDay} className="rounded-xl p-3" />
            {!isAllDay ? <div className="grid grid-cols-2 gap-3"><TimeField id="event-start-time" label="Start" value={startTime} onChange={setStartTime} /><TimeField id="event-end-time" label="End" value={endTime} onChange={setEndTime} /></div> : null}
            <EventColorPicker value={color} onValueChange={setColor} />
          </section>
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter><WorkspaceButton variant="secondary" onClick={onClose}>Cancel</WorkspaceButton><WorkspaceButton variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Add event"}</WorkspaceButton></WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      <DeleteConfirmationModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleConfirmDelete} isDeleting={deleting} title="Delete event" description="Delete this event? This action cannot be undone." />
    </Dialog>
  );
}

function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><label htmlFor={id} className={workspaceLabelClass}>{label}</label><div className="relative"><Input id={id} type="time" value={value} onChange={(event) => onChange(event.target.value)} onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Browser controls the picker. */ } }} className={cn(workspaceFieldClass, "w-full appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden")} /><Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" /></div></div>;
}
