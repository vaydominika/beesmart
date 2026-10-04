"use client";

import { useLocale } from "next-intl";
import { useText } from "@/i18n/use-text";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, LockKeyhole, Pencil, Repeat2, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import { useSettings } from "@/components/settings/SettingsProvider";
import { cn } from "@/lib/utils";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { DEFAULT_EVENT_COLOR } from "./event-palette";
import { EventColorPicker } from "./EventColorPicker";
import { EventReminderFields } from "./EventReminderFields";
import { WorkspaceSwitchRow } from "@/components/ui/workspace-switch-row";
import { readJsonSafely } from "@/lib/http";
import { eventRecordId, formatLongDate, RECURRENCE_OPTIONS, recurrenceLabel } from "@/lib/schedule";
import type { RecurrenceSelection, ScheduleEvent } from "@/lib/schedule";
import { ClassroomWorkEditModal, classroomWorkDeleteEndpoint, classroomWorkKind, isClassroomWorkEvent } from "./ClassroomWorkEditModal";

type EventData = ScheduleEvent;

interface EventDetailModalProps { open: boolean; onClose: () => void; event: EventData; onEventUpdated: () => void }

export function EventDetailModal({ open, onClose, event, onEventUpdated }: EventDetailModalProps) {
  const locale = useLocale();
  const t = useText();
  const { reminderNotifications } = useSettings();
  const [displayEvent, setDisplayEvent] = useState(event);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [editingClassroomWork, setEditingClassroomWork] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startTime, setStartTime] = useState(event.startTime ?? "");
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [isAllDay, setIsAllDay] = useState(event.isAllDay);
  const [color, setColor] = useState(event.color || DEFAULT_EVENT_COLOR);
  const [eventDate, setEventDate] = useState(event.startDate.slice(0, 10));
  const [recurrence, setRecurrence] = useState<RecurrenceSelection>(event.recurrencePattern || "NONE");
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(event.reminder));
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  useEffect(() => {
    if (!open) return;
    setDisplayEvent(event);
    setEditing(false);
    setEditingClassroomWork(false);
    const reminder = event.reminder?.notifyAt ? new Date(event.reminder.notifyAt) : null;
    const pad = (value: number) => String(value).padStart(2, "0");
    setReminderEnabled(Boolean(reminder));
    setReminderDate(reminder ? `${reminder.getFullYear()}-${pad(reminder.getMonth() + 1)}-${pad(reminder.getDate())}` : "");
    setReminderTime(reminder ? `${pad(reminder.getHours())}:${pad(reminder.getMinutes())}` : "");
  }, [event, open]);

  const dateStr = formatLongDate(new Date(displayEvent.startDate), { locale });

  const beginEdit = () => {
    if (isClassroomWorkEvent(displayEvent)) {
      setEditingClassroomWork(true);
      return;
    }
    setTitle(displayEvent.title); setDescription(displayEvent.description ?? ""); setStartTime(displayEvent.startTime ?? ""); setEndTime(displayEvent.endTime ?? ""); setIsAllDay(displayEvent.isAllDay); setColor(displayEvent.color || DEFAULT_EVENT_COLOR); setEventDate((displayEvent.seriesStartDate || displayEvent.startDate).slice(0, 10)); setRecurrence(displayEvent.recurrencePattern || "NONE"); setEditing(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error(t("Title cannot be empty."));
    if (!isAllDay && startTime && endTime && endTime <= startTime) return toast.error(t("End time must be later than start time."));
    setSaving(true);
    try {
      const response = await fetch("/api/user/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eventRecordId(displayEvent), title: title.trim(), description: description.trim() || null, startTime: isAllDay ? null : startTime || null, endTime: isAllDay ? null : endTime || null, isAllDay, color, recurrencePattern: recurrence === "NONE" ? null : recurrence, startDate: `${eventDate}T00:00:00`, endDate: `${eventDate}T00:00:00` }) });
      if (!response.ok) return toast.error(t("Failed to update event."));
      const updatedEvent = await response.json();
      setDisplayEvent(updatedEvent);
      setEditing(false);
      toast.success(t("Event updated"));
      window.setTimeout(onEventUpdated, 100);
    } finally { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const linkedWork = isClassroomWorkEvent(displayEvent);
      const endpoint = classroomWorkDeleteEndpoint(displayEvent) ?? `/api/user/events?id=${eventRecordId(displayEvent)}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return toast.error(t(data.error || t("Failed to delete {v0}.", { v0: linkedWork ? t("assessment") : t("event") })));
      toast.success(t("{v0} deleted", { v0: linkedWork ? t("Assessment") : t("Event") }));
      setShowDeleteModal(false);
      onClose();
      window.setTimeout(onEventUpdated, 100);
    } finally { setDeleting(false); }
  };

  const handleSaveReminder = async () => {
    setSavingReminder(true);
    try {
      if (!reminderEnabled) {
        const response = await fetch(`/api/user/events/${eventRecordId(displayEvent)}/reminder`, { method: "DELETE" });
        if (!response.ok) throw new Error(t("Could not remove event reminder"));
        setDisplayEvent((current) => ({ ...current, reminder: null }));
        toast.success(t("Event reminder removed"));
        onEventUpdated();
        return;
      }
      if (!reminderNotifications) throw new Error(t("Turn on reminder notifications in Settings first"));
      if (!reminderDate || !reminderTime) throw new Error(t("Choose a reminder date and time"));
      const notifyAt = new Date(`${reminderDate}T${reminderTime}:00`);
      const eventDay = displayEvent.startDate.slice(0, 10);
      const eventBoundary = new Date(`${eventDay}T${displayEvent.isAllDay ? "23:59" : displayEvent.startTime || "23:59"}:00`);
      if (notifyAt.getTime() <= Date.now()) throw new Error(t("Reminder time must be in the future"));
      if (notifyAt > eventBoundary) throw new Error(t("Reminder time cannot be after the event starts"));
      const response = await fetch(`/api/user/events/${eventRecordId(displayEvent)}/reminder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyAt: notifyAt.toISOString(), eventStartsAt: eventBoundary.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }) });
      const data = await readJsonSafely<{ error?: string; reminder?: EventData["reminder"] }>(response, {});
      if (!response.ok) throw new Error(data.error || "Could not save event reminder");
      setDisplayEvent((current) => ({ ...current, reminder: data.reminder }));
      toast.success(t("Event reminder saved"));
      onEventUpdated();
    } catch (reminderFailure) { toast.error(t(reminderFailure instanceof Error ? reminderFailure.message : "Could not save event reminder")); }
    finally { setSavingReminder(false); }
  };

  if (editingClassroomWork && isClassroomWorkEvent(displayEvent)) {
    return (
      <ClassroomWorkEditModal
        open={open}
        event={displayEvent}
        onClose={onClose}
        onUpdated={(updatedEvent) => {
          setDisplayEvent(updatedEvent);
          onEventUpdated();
        }}
      />
    );
  }

  const classroomWork = isClassroomWorkEvent(displayEvent);
  const workKind = classroomWorkKind(displayEvent);
  const classroomWorkLabel = workKind ? t(workKind) : null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent className="max-w-lg">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{editing ? t("Edit event") : displayEvent.title}</WorkspaceDialogTitle>
          <WorkspaceDialogDescription>{dateStr}</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="space-y-5">
          {editing ? (
            <div className="space-y-4">
              <Field id="event-edit-date" label={t("Date")} type="date" value={eventDate} onChange={setEventDate} />
              <div><label className={workspaceLabelClass}>{t("Repeats")}</label><WorkspaceSelect ariaLabel={t("Repeats")} value={recurrence} options={RECURRENCE_OPTIONS} translateLabels onValueChange={setRecurrence} triggerIcon={Repeat2} className="w-full" /></div>
              <Field id="event-edit-title" label={t("Title")} value={title} onChange={setTitle} />
              <div><label htmlFor="event-edit-description" className={workspaceLabelClass}>{t("Description")}</label><textarea id="event-edit-description" value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} rows={3} className={`${workspaceFieldClass} h-auto min-h-20 w-full resize-y py-2.5`} /></div>
              <WorkspaceSwitchRow id="event-edit-all-day" label={t("All day")} checked={isAllDay} onCheckedChange={setIsAllDay} className="rounded-xl p-3" />
              {!isAllDay ? <div className="grid grid-cols-2 gap-3"><Field id="event-edit-start" label={t("Start")} type="time" value={startTime} onChange={setStartTime} /><Field id="event-edit-end" label={t("End")} type="time" value={endTime} onChange={setEndTime} /></div> : null}
              <EventColorPicker value={color} onValueChange={setColor} />
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]"><Clock className="h-4 w-4 text-[var(--app-text-muted)]" />{displayEvent.isAllDay ? t("All day") : t("{v0}{v1}", { v0: displayEvent.startTime || t("No start time"), v1: displayEvent.endTime ? ` – ${displayEvent.endTime}` : "" })}</div>
                {displayEvent.recurrencePattern ? <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--app-text-muted)]"><Repeat2 className="h-3.5 w-3.5" />{t(recurrenceLabel(displayEvent.recurrencePattern))}</p> : null}
                {displayEvent.description ? <p className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">{displayEvent.description}</p> : null}
                {displayEvent.isProtected ? <p className="mt-3 flex items-center gap-2 text-xs text-[var(--app-text-faint)]"><LockKeyhole className="h-3.5 w-3.5" />{displayEvent.canEdit === false ? t("Managed by your teacher") : t("Synchronized with Classroom")}</p> : null}
              </div>
              {!displayEvent.recurrencePattern ? <EventReminderFields enabled={reminderEnabled} onEnabledChange={setReminderEnabled} date={reminderDate} onDateChange={setReminderDate} time={reminderTime} onTimeChange={setReminderTime} notificationsEnabled={reminderNotifications} inputClassName={workspaceFieldClass}>
                <WorkspaceButton type="button" variant={reminderEnabled ? "primary" : "secondary"} onClick={handleSaveReminder} disabled={savingReminder || (reminderEnabled && !reminderNotifications) || (!reminderEnabled && !displayEvent.reminder)} className="mt-3 w-full">{savingReminder ? t("Saving…") : reminderEnabled ? displayEvent.reminder ? t("Update reminder") : t("Set reminder") : displayEvent.reminder ? t("Remove reminder") : t("No reminder")}</WorkspaceButton>
              </EventReminderFields> : <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-xs text-[var(--app-text-muted)]">{t("Reminders are available for one-time events.")}</p>}
            </>
          )}
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter className="justify-between sm:justify-between">
          <div>{displayEvent.canEdit !== false && !editing ? <WorkspaceButton type="button" variant="danger" onClick={() => setShowDeleteModal(true)}><Trash2 className="h-4 w-4" />{t("Delete")} {classroomWorkLabel ?? t("event")}</WorkspaceButton> : null}</div>
          <div className="flex gap-2">{editing ? <><WorkspaceButton type="button" variant="secondary" onClick={() => setEditing(false)}>{t("Cancel")}</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={saving}>{saving ? <><Spinner className="h-4 w-4" />{t("Saving…")}</> : t("Save changes")}</WorkspaceButton></> : displayEvent.canEdit !== false ? <WorkspaceButton type="button" variant="secondary" onClick={beginEdit}><Pencil className="h-4 w-4" />{t("Edit")} {classroomWorkLabel ?? t("event")}</WorkspaceButton> : null}</div>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
      <DeleteConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleting}
        title={t("Delete {v0}", { v0: classroomWorkLabel ?? t("event") })}
        description={classroomWork
          ? t("Delete this {v0} and all of its submissions and grades? This action cannot be undone.", { v0: classroomWorkLabel })
          : displayEvent.recurrencePattern ? t("Delete this entire recurring event series? This action cannot be undone.") : t("Delete this event? This action cannot be undone.")}
      />
    </Dialog>
  );
}

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><label htmlFor={id} className={workspaceLabelClass}>{label}</label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn(workspaceFieldClass, "w-full")} /></div>;
}
