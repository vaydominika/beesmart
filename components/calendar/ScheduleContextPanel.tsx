"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, CalendarPlus, Clock3, LockKeyhole, Pencil, School, Trash2, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  ScheduleEvent,
  ScheduleEventInput,
  dateKey,
  eventSourceLabel,
  eventsForDate,
  formatLongDate,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

export interface ScheduleEditorState {
  mode: "create" | "edit";
  date: Date;
  startTime?: string;
  endTime?: string;
}

interface ScheduleContextPanelProps {
  selectedDate: Date;
  events: ScheduleEvent[];
  selectedEvent: ScheduleEvent | null;
  editor: ScheduleEditorState | null;
  saving: boolean;
  deleting: boolean;
  onSelectEvent: (event: ScheduleEvent) => void;
  onStartCreate: (date: Date) => void;
  onStartEdit: (event: ScheduleEvent) => void;
  onBack: () => void;
  onSave: (input: ScheduleEventInput) => void;
  onDelete: (event: ScheduleEvent) => void;
}

const COLORS = ["#FADA6D", "#FF7A72", "#4ECDC4", "#6CB6D9", "#96CEB4", "#B9A6E8"];

function SourceIcon({ source }: { source: ScheduleEvent["source"] }) {
  if (source === "classroom") return <School className="h-3.5 w-3.5" />;
  if (source === "course") return <BookOpen className="h-3.5 w-3.5" />;
  return <UserRound className="h-3.5 w-3.5" />;
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
  const dayEvents = eventsForDate(events, selectedDate);
  const editingEvent = editor?.mode === "edit" ? selectedEvent : null;
  const [title, setTitle] = useState(editingEvent?.title || "");
  const [description, setDescription] = useState(editingEvent?.description || "");
  const [eventDate, setEventDate] = useState(editingEvent ? dateKey(editingEvent.startDate) : editor ? dateKey(editor.date) : dateKey(selectedDate));
  const [startTime, setStartTime] = useState(editingEvent?.startTime || editor?.startTime || "");
  const [endTime, setEndTime] = useState(editingEvent?.endTime || editor?.endTime || "");
  const [isAllDay, setIsAllDay] = useState(editingEvent?.isAllDay || false);
  const [color, setColor] = useState(editingEvent?.color || COLORS[0]);
  const [validation, setValidation] = useState<string | null>(null);

  if (editor) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--schedule-line)] px-4 py-2.5">
          <button type="button" onClick={onBack} aria-label="Back to agenda" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--schedule-line)] bg-white text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">
            <ArrowLeft className="h-4 w-4" />
          </button>
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
              setValidation(null);
              onSave({
                title: title.trim(),
                description: description.trim() || null,
                date: eventDate,
                startTime: isAllDay ? null : startTime || null,
                endTime: isAllDay ? null : endTime || null,
                isAllDay,
                color,
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
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold text-[var(--schedule-text-muted)]">Color</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((eventColor) => (
                  <button key={eventColor} type="button" onClick={() => setColor(eventColor)} aria-label={`Select color ${eventColor}`} className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]", color === eventColor ? "scale-105 border-[var(--schedule-text)]" : "border-white")} style={{ backgroundColor: eventColor }} />
                ))}
              </div>
            </fieldset>
            {validation && <p role="alert" className="rounded-xl bg-[var(--schedule-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--schedule-danger)]">{validation}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onBack} className="h-10 flex-1 rounded-lg border border-[var(--schedule-line)] bg-white px-4 text-sm font-semibold text-[var(--schedule-text)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]">Cancel</button>
              <button type="submit" disabled={saving} className="h-10 flex-1 rounded-lg border border-[var(--schedule-accent-hover)] bg-[var(--schedule-accent)] px-4 text-sm font-semibold text-[var(--schedule-text)] hover:bg-[var(--schedule-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)] disabled:opacity-60">{saving ? "Saving…" : editor.mode === "edit" ? "Save changes" : "Add event"}</button>
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
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--schedule-text-muted)] hover:text-[var(--schedule-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><ArrowLeft className="h-4 w-4" />Agenda</button>
          {selectedEvent.canEdit !== false && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onStartEdit(selectedEvent)} aria-label="Edit event" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-line)] bg-white text-[var(--schedule-text-muted)] hover:bg-[var(--schedule-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => onDelete(selectedEvent)} disabled={deleting} aria-label="Delete event" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-line)] bg-white text-[var(--schedule-danger)] hover:bg-[var(--schedule-danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-danger)] disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        </div>
        <div className="schedule-scroll flex-1 overflow-y-auto px-5 py-5">
          <h2 className="text-xl font-semibold leading-tight text-[var(--schedule-text)]">{selectedEvent.title}</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[var(--schedule-text-muted)]">{formatLongDate(new Date(selectedEvent.startDate))}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-black/5 px-2.5 text-[11px] font-semibold leading-none text-[#20231f]" style={{ backgroundColor: selectedEvent.color || "var(--schedule-accent)", borderColor: selectedEvent.color || "var(--schedule-accent-hover)" }} title={eventSourceLabel(selectedEvent)}><SourceIcon source={selectedEvent.source} /><span className="truncate">{eventSourceLabel(selectedEvent)}</span></span>
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-black/5 px-2.5 text-[11px] font-semibold leading-none text-[#20231f]" style={{ backgroundColor: selectedEvent.color || "var(--schedule-accent)", borderColor: selectedEvent.color || "var(--schedule-accent-hover)" }}><Clock3 className="h-3.5 w-3.5" />{selectedEvent.isAllDay ? "All day" : `${selectedEvent.startTime || "No start"}${selectedEvent.endTime ? `–${selectedEvent.endTime}` : ""}`}</span>
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
        <button type="button" onClick={() => onStartCreate(selectedDate)} aria-label="New event" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--schedule-accent-hover)] bg-[var(--schedule-accent)] text-[var(--schedule-text)] hover:bg-[var(--schedule-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"><CalendarPlus className="h-4 w-4" /></button>
      </div>
      <div className="schedule-scroll flex-1 overflow-y-auto p-3">
        {dayEvents.length ? (
          <div className="space-y-2">
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onSelectEvent(event)}
                className="w-full rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(32,35,31,0.04)] transition-[background-color,box-shadow] hover:bg-[var(--schedule-surface-hover)] hover:shadow-[0_2px_6px_rgba(32,35,31,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-focus-border)]"
                style={{ borderColor: event.color || "var(--schedule-accent-hover)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--schedule-text)]">{event.title}</span>
                    {event.canEdit === false && <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[var(--schedule-text-faint)]" />}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[var(--schedule-text-muted)]">{event.isAllDay ? "All day" : `${event.startTime || "—"}${event.endTime ? `–${event.endTime}` : ""}`}</p>
                  <span className="mt-2 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-[var(--schedule-text-faint)]" title={eventSourceLabel(event)}><SourceIcon source={event.source} /><span className="truncate">{eventSourceLabel(event)}</span></span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-52 flex-col items-center justify-center px-3 text-center">
            <CalendarDays className="mb-3 h-6 w-6 text-[var(--schedule-text-faint)]" />
            <p className="text-sm font-medium text-[var(--schedule-text)]">Nothing planned for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}
