"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarDays, Clock, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
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
import { useSettings } from "@/components/settings/SettingsProvider";
import { cn } from "@/lib/utils";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { DEFAULT_EVENT_COLOR, EVENT_COLOR_OPTIONS } from "./event-palette";

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  color?: string | null;
  endDate?: string;
  isProtected?: boolean;
  canEdit?: boolean;
  reminder?: { notifyAt: string; notificationProcessedAt: string | null } | null;
}

interface EventDetailModalProps { open: boolean; onClose: () => void; event: EventData; onEventUpdated: () => void }

export function EventDetailModal({ open, onClose, event, onEventUpdated }: EventDetailModalProps) {
  const { reminderNotifications } = useSettings();
  const [displayEvent, setDisplayEvent] = useState(event);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startTime, setStartTime] = useState(event.startTime ?? "");
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [isAllDay, setIsAllDay] = useState(event.isAllDay);
  const [color, setColor] = useState(event.color || DEFAULT_EVENT_COLOR);
  const [eventDate, setEventDate] = useState(event.startDate.slice(0, 10));
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(event.reminder));
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayEvent(event);
    setEditing(false);
    const reminder = event.reminder?.notifyAt ? new Date(event.reminder.notifyAt) : null;
    const pad = (value: number) => String(value).padStart(2, "0");
    setReminderEnabled(Boolean(reminder));
    setReminderDate(reminder ? `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}` : "");
    setReminderTime(reminder ? `${pad(reminder.getHours())}:${pad(reminder.getMinutes())}` : "");
  }, [event, open]);

  const dateStr = new Date(displayEvent.startDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const beginEdit = () => {
    setTitle(displayEvent.title); setDescription(displayEvent.description ?? ""); setStartTime(displayEvent.startTime ?? ""); setEndTime(displayEvent.endTime ?? ""); setIsAllDay(displayEvent.isAllDay); setColor(displayEvent.color || DEFAULT_EVENT_COLOR); setEventDate(displayEvent.startDate.slice(0, 10)); setEditing(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Title cannot be empty.");
    if (!isAllDay && startTime && endTime && endTime <= startTime) return toast.error("End time must be later than start time.");
    setSaving(true);
    try {
      const response = await fetch("/api/user/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: event.id, title: title.trim(), description: description.trim() || null, startTime: isAllDay ? null : startTime || null, endTime: isAllDay ? null : endTime || null, isAllDay, color, startDate: `${eventDate}T00:00:00`, endDate: `${eventDate}T00:00:00` }) });
      if (!response.ok) return toast.error("Failed to update event.");
      const updatedEvent = await response.json();
      setDisplayEvent(updatedEvent);
      setEditing(false);
      toast.success("Event updated");
      window.setTimeout(onEventUpdated, 100);
    } finally { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/user/events?id=${event.id}`, { method: "DELETE" });
      if (!response.ok) return toast.error("Failed to delete event.");
      toast.success("Event deleted");
      setShowDeleteModal(false);
      onClose();
      window.setTimeout(onEventUpdated, 100);
    } finally { setDeleting(false); }
  };

  const handleSaveReminder = async () => {
    setSavingReminder(true);
    try {
      if (!reminderEnabled) {
        const response = await fetch(`/api/user/events/${displayEvent.id}/reminder`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not remove event reminder");
        setDisplayEvent((current) => ({ ...current, reminder: null }));
        toast.success("Event reminder removed");
        onEventUpdated();
        return;
      }
      if (!reminderNotifications) throw new Error("Turn on reminder notifications in Settings first");
      if (!reminderDate || !reminderTime) throw new Error("Choose a reminder date and time");
      const notifyAt = new Date(`${reminderDate}T${reminderTime}:00`);
      const eventDay = displayEvent.startDate.slice(0, 10);
      const eventBoundary = new Date(`${eventDay}T${displayEvent.isAllDay ? "23:59" : displayEvent.startTime || "23:59"}:00`);
      if (notifyAt.getTime() <= Date.now()) throw new Error("Reminder time must be in the future");
      if (notifyAt > eventBoundary) throw new Error("Reminder time cannot be after the event starts");
      const response = await fetch(`/api/user/events/${displayEvent.id}/reminder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyAt: notifyAt.toISOString(), eventStartsAt: eventBoundary.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save event reminder");
      setDisplayEvent((current) => ({ ...current, reminder: data.reminder }));
      toast.success("Event reminder saved");
      onEventUpdated();
    } catch (reminderFailure) { toast.error(reminderFailure instanceof Error ? reminderFailure.message : "Could not save event reminder"); }
    finally { setSavingReminder(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent className="max-w-lg">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent-text)]"><CalendarDays className="h-4 w-4" /></span>{editing ? "Edit event" : displayEvent.title}</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>{dateStr}</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="space-y-5">
          {editing ? (
            <div className="space-y-4">
              <Field id="event-edit-date" label="Date" type="date" value={eventDate} onChange={setEventDate} />
              <Field id="event-edit-title" label="Title" value={title} onChange={setTitle} />
              <div><label htmlFor="event-edit-description" className={workspaceLabelClass}>Description</label><textarea id="event-edit-description" value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} rows={3} className={`${workspaceFieldClass} h-auto min-h-20 w-full resize-y py-2.5`} /></div>
              <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] p-3"><label htmlFor="event-edit-all-day" className="text-sm font-semibold text-[var(--app-text)]">All day</label><Switch id="event-edit-all-day" checked={isAllDay} onCheckedChange={setIsAllDay} /></div>
              {!isAllDay ? <div className="grid grid-cols-2 gap-3"><Field id="event-edit-start" label="Start" type="time" value={startTime} onChange={setStartTime} /><Field id="event-edit-end" label="End" type="time" value={endTime} onChange={setEndTime} /></div> : null}
              <div><span className={workspaceLabelClass}>Color</span><div className="flex flex-wrap gap-2">{EVENT_COLOR_OPTIONS.map((option) => <button key={option.value} type="button" aria-label={`Select ${option.label}`} aria-pressed={color === option.value} onClick={() => setColor(option.value)} className={cn("h-8 w-8 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]", color === option.value ? "border-[var(--app-text)]" : "border-[var(--app-surface)]")} style={{ backgroundColor: option.value }} />)}</div></div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]"><Clock className="h-4 w-4 text-[var(--app-text-muted)]" />{displayEvent.isAllDay ? "All day" : `${displayEvent.startTime || "No start time"}${displayEvent.endTime ? ` – ${displayEvent.endTime}` : ""}`}</div>
                {displayEvent.description ? <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">{displayEvent.description}</p> : null}
                {displayEvent.isProtected ? <p className="mt-3 flex items-center gap-2 text-xs text-[var(--app-text-faint)]"><LockKeyhole className="h-3.5 w-3.5" />{displayEvent.canEdit === false ? "Managed by your teacher" : "Synchronized with Classroom"}</p> : null}
              </div>
              <section aria-labelledby="event-reminder-heading" className="rounded-2xl border border-[var(--app-border)] p-4">
                <div className="flex items-center justify-between gap-4"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent-text)]"><BellRing className="h-4 w-4" /></span><div><h3 id="event-reminder-heading" className="text-sm font-semibold text-[var(--app-text)]">Event reminder</h3><p className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">{reminderNotifications ? "Get an in-app notification before this event." : "Reminder notifications are off in Settings."}</p></div></div><Switch checked={reminderEnabled} disabled={!reminderNotifications && !reminderEnabled} onCheckedChange={setReminderEnabled} aria-label="Event reminder" /></div>
                {reminderEnabled ? <div className="mt-4 grid grid-cols-2 gap-2"><Input type="date" aria-label="Reminder date" value={reminderDate} onChange={(changeEvent) => setReminderDate(changeEvent.target.value)} className={workspaceFieldClass} /><Input type="time" aria-label="Reminder time" value={reminderTime} onChange={(changeEvent) => setReminderTime(changeEvent.target.value)} className={workspaceFieldClass} /></div> : null}
                <WorkspaceButton type="button" variant={reminderEnabled ? "primary" : "secondary"} onClick={handleSaveReminder} disabled={savingReminder || (reminderEnabled && !reminderNotifications) || (!reminderEnabled && !displayEvent.reminder)} className="mt-3 w-full">{savingReminder ? "Saving…" : reminderEnabled ? displayEvent.reminder ? "Update reminder" : "Set reminder" : displayEvent.reminder ? "Remove reminder" : "No reminder"}</WorkspaceButton>
              </section>
            </>
          )}
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter className="justify-between sm:justify-between">
          <div>{displayEvent.canEdit !== false && !editing ? <WorkspaceButton type="button" variant="danger" onClick={() => setShowDeleteModal(true)}><Trash2 className="h-4 w-4" />Delete</WorkspaceButton> : null}</div>
          <div className="flex gap-2">{editing ? <><WorkspaceButton type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={saving}>{saving ? <><Spinner className="h-4 w-4" />Saving…</> : "Save changes"}</WorkspaceButton></> : displayEvent.canEdit !== false ? <WorkspaceButton type="button" variant="secondary" onClick={beginEdit}><Pencil className="h-4 w-4" />Edit event</WorkspaceButton> : null}</div>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      <DeleteConfirmationModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleConfirmDelete} isDeleting={deleting} />
    </Dialog>
  );
}

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><label htmlFor={id} className={workspaceLabelClass}>{label}</label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn(workspaceFieldClass, "w-full")} /></div>;
}
