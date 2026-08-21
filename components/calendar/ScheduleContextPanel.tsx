"use client";

import { useState } from "react";
import { ArrowLeft, CalendarPlus, Clock3, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  ScheduleEvent,
  ScheduleEventInput,
  type ScheduleSelectionProps,
  dateKey,
  eventSourceLabel,
  eventsForDate,
  formatLongDate,
} from "@/lib/schedule";
import { useSettings } from "@/components/settings/SettingsProvider";
import { EventSourceIcon } from "./EventSourceIcon";
import { EventColorPicker } from "./EventColorPicker";
import { EventReminderFields } from "./EventReminderFields";
import { DEFAULT_EVENT_COLOR } from "./event-palette";

export interface ScheduleEditorState {
  mode: "create" | "edit";
  date: Date;
  startTime?: string;
  endTime?: string;
}

interface ScheduleContextPanelProps extends ScheduleSelectionProps {
  selectedDate: Date;
  events: ScheduleEvent[];
  selectedEvent: ScheduleEvent | null;
  editor: ScheduleEditorState | null;
  saving: boolean;
  deleting: boolean;
  onStartCreate: (date: Date) => void;
  onStartEdit: (event: ScheduleEvent) => void;
  onBack: () => void;
  onSave: (input: ScheduleEventInput) => void;
  onDelete: (event: ScheduleEvent) => void;
}

export function ScheduleContextPanel(props: ScheduleContextPanelProps) {
  const identity = props.editor
    ? `${props.editor.mode}-${props.selectedEvent?.id || dateKey(props.editor.date)}-${props.editor.startTime || ""}`
    : props.selectedEvent?.id || dateKey(props.selectedDate);
  return <ScheduleContextPanelContent key={identity} {...props} />;
}

function ScheduleContextPanelContent({
  selectedDate,
  events,
  selectedEvent,
  editor,
  saving,
  deleting,
  onSelectEvent,
  onStartCreate,
  onStartEdit,
  onBack,
  onSave,
  onDelete,
}: ScheduleContextPanelProps) {
  const { reminderNotifications } = useSettings();
  const dayEvents = eventsForDate(events, selectedDate);
  const editingEvent = editor?.mode === "edit" ? selectedEvent : null;
  const initialReminder = editingEvent?.reminder?.notifyAt ? new Date(editingEvent.reminder.notifyAt) : null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const [title, setTitle] = useState(editingEvent?.title || "");
  const [description, setDescription] = useState(editingEvent?.description || "");
  const [eventDate, setEventDate] = useState(editingEvent ? dateKey(editingEvent.startDate) : editor ? dateKey(editor.date) : dateKey(selectedDate));
  const [startTime, setStartTime] = useState(editingEvent?.startTime || editor?.startTime || "");
  const [endTime, setEndTime] = useState(editingEvent?.endTime || editor?.endTime || "");
  const [isAllDay, setIsAllDay] = useState(editingEvent?.isAllDay || false);
  const [color, setColor] = useState(editingEvent?.color || DEFAULT_EVENT_COLOR);
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(initialReminder));
  const [reminderDate, setReminderDate] = useState(initialReminder ? `${initialReminder.getFullYear()}-${pad(initialReminder.getMonth() + 1)}-${pad(initialReminder.getDate())}` : "");
  const [reminderTime, setReminderTime] = useState(initialReminder ? `${pad(initialReminder.getHours())}:${pad(initialReminder.getMinutes())}` : "");
  const [validation, setValidation] = useState<string | null>(null);

  if (editor) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--schedule-line)] px-4 py-2.5">
          <WorkspaceButton type="button" variant="secondary" size="icon-compact" onClick={onBack} aria-label="Back to agenda">
            <ArrowLeft className="h-4 w-4" />
          </WorkspaceButton>
          <div>
            <h2 className="text-sm font-semibold text-[var(--schedule-text)]">{editor.mode === "edit" ? "Edit event" : "New event"}</h2>
            <p className="text-[11px] text-[var(--schedule-text-muted)]">{editor.mode === "edit" ? "Update the event details." : "Add time to your schedule."}</p>
          </div>
        </div>
        <div className="schedule-scroll flex-1 overflow-y-auto px-4 py-2.5">
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) {
                setValidation("Enter an event title.");
                return;
              }
              if (!isAllDay && startTime && endTime && endTime <= startTime) {
                setValidation("End time must be later than start time.");
                return;
              }
              let reminder = null;
              if (reminderEnabled) {
                if (!reminderNotifications) {
                  setValidation("Turn on reminder notifications in Settings first.");
                  return;
                }
                if (!reminderDate || !reminderTime) {
                  setValidation("Choose a reminder date and time.");
                  return;
                }
                const notifyAt = new Date(`${reminderDate}T${reminderTime}:00`);
                const eventStartsAt = new Date(`${eventDate}T${isAllDay ? "23:59" : startTime || "23:59"}:00`);
                if (Number.isNaN(notifyAt.getTime()) || notifyAt.getTime() <= Date.now()) {
                  setValidation("Reminder time must be in the future.");
                  return;
                }
                if (Number.isNaN(eventStartsAt.getTime()) || notifyAt > eventStartsAt) {
                  setValidation("Reminder time cannot be after the event starts.");
                  return;
                }
                reminder = {
                  notifyAt: notifyAt.toISOString(),
                  eventStartsAt: eventStartsAt.toISOString(),
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                };
              }
              setValidation(null);
              onSave({
                title: title.trim(),
                description: description.trim() || null,
                date: eventDate,
                startTime: isAllDay ? null : startTime || null,
                endTime: isAllDay ? null : endTime || null,
                isAllDay,
                color,
                reminder,
              });
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--schedule-text-muted)]">Title</span>
              <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title" className="h-10 rounded-lg border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] text-sm font-medium focus-visible:border-[var(--schedule-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-ring)]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--schedule-text-muted)]">Date</span>
              <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="h-10 rounded-lg border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] text-sm font-medium focus-visible:border-[var(--schedule-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-ring)]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--schedule-text-muted)]">Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional notes" rows={2} className="w-full resize-none rounded-lg border border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] px-3 py-2 text-sm text-[var(--schedule-text)] outline-none placeholder:text-[var(--schedule-text-faint)] focus:border-[var(--schedule-focus-border)] focus:ring-2 focus:ring-[var(--schedule-focus-ring)]" />
            </label>
            <div className="flex items-center justify-between rounded-lg border border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] px-3 py-2">
              <div>
                <span className="block text-sm font-medium text-[var(--schedule-text)]">All day</span>
                <span className="text-[11px] text-[var(--schedule-text-muted)]">Hide specific start and end times.</span>
              </div>
              <Switch checked={isAllDay} onCheckedChange={setIsAllDay} aria-label="All day" className="data-[state=checked]:bg-[var(--schedule-focus-border)] data-[state=unchecked]:bg-[var(--schedule-line-strong)]" />
            </div>
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--schedule-text-muted)]">Start</span>
                  <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="h-10 rounded-lg border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] text-sm font-medium focus-visible:border-[var(--schedule-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-ring)]" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--schedule-text-muted)]">End</span>
                  <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="h-10 rounded-lg border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] text-sm font-medium focus-visible:border-[var(--schedule-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-ring)]" />
                </label>
              </div>
            )}
            <EventReminderFields enabled={reminderEnabled} onEnabledChange={setReminderEnabled} date={reminderDate} onDateChange={setReminderDate} time={reminderTime} onTimeChange={setReminderTime} notificationsEnabled={reminderNotifications} maxDate={eventDate} className="rounded-lg border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] px-3 py-2.5" inputClassName="h-9 rounded-lg border-[var(--schedule-line)] bg-[var(--app-surface)] text-xs font-medium focus-visible:border-[var(--schedule-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-ring)]" />
            <EventColorPicker value={color} onValueChange={setColor} compact />
            {validation && <p role="alert" className="rounded-xl bg-[var(--schedule-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--schedule-danger)]">{validation}</p>}
            <div className="flex gap-2">
              <WorkspaceButton type="button" variant="secondary" onClick={onBack} className="flex-1">Cancel</WorkspaceButton>
              <WorkspaceButton type="submit" variant="primary" disabled={saving} className="flex-1">{saving ? "Saving…" : editor.mode === "edit" ? "Save changes" : "Add event"}</WorkspaceButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (selectedEvent) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--schedule-line)] px-5 py-4">
          <WorkspaceButton type="button" variant="ghost" size="compact" onClick={onBack}><ArrowLeft className="h-4 w-4" />Agenda</WorkspaceButton>
          {selectedEvent.canEdit !== false && (
            <div className="flex gap-2">
              <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => onStartEdit(selectedEvent)} aria-label="Edit event"><Pencil className="h-4 w-4" /></WorkspaceButton>
              <WorkspaceButton type="button" variant="danger" size="icon" onClick={() => onDelete(selectedEvent)} disabled={deleting} aria-label="Delete event"><Trash2 className="h-4 w-4" /></WorkspaceButton>
            </div>
          )}
        </div>
        <div className="schedule-scroll flex-1 overflow-y-auto px-5 py-5">
          <h2 className="text-xl font-semibold leading-tight text-[var(--schedule-text)]">{selectedEvent.title}</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--schedule-text-muted)]">{formatLongDate(new Date(selectedEvent.startDate))}</p>
          <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-[var(--app-scrim-soft)] px-2.5 text-[11px] font-semibold leading-none text-[var(--app-event-text)]" style={{ backgroundColor: selectedEvent.color || "var(--schedule-accent)", borderColor: selectedEvent.color || "var(--schedule-accent-hover)" }} title={eventSourceLabel(selectedEvent)}><EventSourceIcon source={selectedEvent.source} /><span className="truncate">{eventSourceLabel(selectedEvent)}</span></span>
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--app-scrim-soft)] px-2.5 text-[11px] font-semibold leading-none text-[var(--app-event-text)]" style={{ backgroundColor: selectedEvent.color || "var(--schedule-accent)", borderColor: selectedEvent.color || "var(--schedule-accent-hover)" }}><Clock3 className="h-3.5 w-3.5" />{selectedEvent.isAllDay ? "All day" : `${selectedEvent.startTime || "No start"}${selectedEvent.endTime ? `–${selectedEvent.endTime}` : ""}`}</span>
          </div>
          {selectedEvent.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--schedule-text-muted)]">{selectedEvent.description}</p>}
          {selectedEvent.canEdit === false && (
            <div className="mt-6 flex gap-3 rounded-xl border border-[var(--schedule-line)] bg-[var(--schedule-surface-muted)] p-3 text-sm text-[var(--schedule-text-muted)]">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This event is managed by your teacher. You can view it here, but you cannot change it.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between border-b border-[var(--schedule-line)] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--schedule-text)]">{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
          <p className="mt-0.5 text-xs text-[var(--schedule-text-muted)]">{dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}` : "No events yet"}</p>
        </div>
        <WorkspaceButton type="button" variant="primary" size="icon" onClick={() => onStartCreate(selectedDate)} aria-label="New event"><CalendarPlus className="h-4 w-4" /></WorkspaceButton>
      </div>
      <div className="schedule-scroll flex-1 overflow-y-auto p-3">
        {dayEvents.length ? (
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="w-full rounded-xl border bg-[var(--app-surface)] p-3 text-left shadow-[var(--app-shadow-subtle)] transition-[background-color,box-shadow] hover:bg-[var(--schedule-surface-hover)] hover:shadow-[var(--app-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"
                style={{ borderColor: event.color || "var(--schedule-accent-hover)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--schedule-text)]">{event.title}</span>
                    {event.canEdit === false && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[var(--schedule-text-faint)]" />}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[var(--schedule-text-muted)]">{event.isAllDay ? "All day" : `${event.startTime || "—"}${event.endTime ? `–${event.endTime}` : ""}`}</p>
                  <span className="mt-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-[var(--schedule-text-faint)]" title={eventSourceLabel(event)}><EventSourceIcon source={event.source} /><span className="truncate">{eventSourceLabel(event)}</span></span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-52 flex-col items-center justify-center px-3 text-center">
            <p className="text-sm font-medium text-[var(--schedule-text)]">Nothing planned for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}
