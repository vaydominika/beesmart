"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Pen01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { BellRing, Trash2, Clock, LockKeyhole } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { useSettings } from "@/components/settings/SettingsProvider";

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

interface EventDetailModalProps {
    open: boolean;
    onClose: () => void;
    event: EventData;
    onEventUpdated: () => void;
}

export function EventDetailModal({ open, onClose, event, onEventUpdated }: EventDetailModalProps) {
    const { reminderNotifications } = useSettings();
    const [displayEvent, setDisplayEvent] = useState(event);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const initialReminder = event.reminder?.notifyAt ? new Date(event.reminder.notifyAt) : null;
    const pad = (value: number) => String(value).padStart(2, "0");
    const [reminderEnabled, setReminderEnabled] = useState(Boolean(initialReminder));
    const [reminderDate, setReminderDate] = useState(initialReminder ? `${initialReminder.getFullYear()}-${pad(initialReminder.getMonth() + 1)}-${pad(initialReminder.getDate())}` : "");
    const [reminderTime, setReminderTime] = useState(initialReminder ? `${pad(initialReminder.getHours())}:${pad(initialReminder.getMinutes())}` : "");
    const [savingReminder, setSavingReminder] = useState(false);

    // Edit state
    const [title, setTitle] = useState(event.title);
    const [description, setDescription] = useState(event.description ?? "");
    const [startTime, setStartTime] = useState(event.startTime ?? "");
    const [endTime, setEndTime] = useState(event.endTime ?? "");
    const [isAllDay, setIsAllDay] = useState(event.isAllDay);
    const [color, setColor] = useState(event.color || "#FEC435");
    const [eventDate, setEventDate] = useState(event.startDate.slice(0, 10));

    // Format date for display
    const d = new Date(displayEvent.startDate);
    const dateStr = `${d.getFullYear()}. ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}. ${d.toLocaleDateString("en-US", { weekday: "long" })}`;

    const handleEdit = () => {
        setTitle(displayEvent.title);
        setDescription(displayEvent.description ?? "");
        setStartTime(displayEvent.startTime ?? "");
        setEndTime(displayEvent.endTime ?? "");
        setIsAllDay(displayEvent.isAllDay);
        setColor(displayEvent.color || "#FEC435");
        setEventDate(displayEvent.startDate.slice(0, 10));
        setEditing(true);
    };

    const handleCancel = () => {
        if (editing) {
            setEditing(false);
        } else {
            onClose();
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Title cannot be empty.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/user/events", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: event.id,
                    title: title.trim(),
                    description: description.trim() || null,
                    startTime: isAllDay ? null : startTime || null,
                    endTime: isAllDay ? null : endTime || null,
                    isAllDay,
                    color,
                    startDate: `${eventDate}T00:00:00`,
                    endDate: `${eventDate}T00:00:00`,
                }),
            });
            if (!res.ok) {
                toast.error("Failed to update event.");
                return;
            }
            const updatedEvent = await res.json();
            toast.success("Event updated!");
            setDisplayEvent(updatedEvent);
            setEditing(false);
            setDisplayEvent(updatedEvent);
            setEditing(false);
            // Small delay to ensure DB propagation before parent refetch
            setTimeout(() => {
                onEventUpdated();
            }, 100);
        } catch {
            toast.error("Failed to update event.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/user/events?id=${event.id}`, { method: "DELETE" });
            if (!res.ok) {
                toast.error("Failed to delete event.");
                return;
            }
            toast.success("Event deleted.");
            setShowDeleteModal(false);
            onClose();
            // Small delay to ensure DB propagation before parent refetch
            setTimeout(() => {
                onEventUpdated();
            }, 100);
        } catch {
            toast.error("Failed to delete event.");
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveReminder = async () => {
        setSavingReminder(true);
        try {
            if (!reminderEnabled) {
                const response = await fetch(`/api/user/events/${displayEvent.id}/reminder`, { method: "DELETE" });
                if (!response.ok) throw new Error("Could not remove event reminder");
                setDisplayEvent((current) => ({ ...current, reminder: null }));
                toast.success("Event reminder removed.");
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
            const response = await fetch(`/api/user/events/${displayEvent.id}/reminder`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notifyAt: notifyAt.toISOString(),
                    eventStartsAt: eventBoundary.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Could not save event reminder");
            setDisplayEvent((current) => ({ ...current, reminder: data.reminder }));
            toast.success(`Event reminder set for ${notifyAt.toLocaleString()}.`);
            onEventUpdated();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save event reminder.");
        } finally {
            setSavingReminder(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none [&>button]:hidden">
                <DialogTitle className="sr-only">Event Details</DialogTitle>
                <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-(--theme-bg) p-4 md:p-8">
                    {/* Top bar: pencil left, cancel right */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                            {displayEvent.canEdit !== false && (
                                <>
                                    <WorkspaceButton
                                        variant="ghost"
                                        size="icon-compact"
                                        onClick={handleEdit}
                                        aria-label="Edit event"
                                    >
                                        <HugeiconsIcon icon={Pen01Icon} size={16} strokeWidth={2.2} />
                                    </WorkspaceButton>
                                    <WorkspaceButton
                                        variant="danger"
                                        size="icon-compact"
                                        onClick={handleDeleteClick}
                                        aria-label="Delete event"
                                    >
                                        <Trash2 strokeWidth={2.2} />
                                    </WorkspaceButton>
                                </>
                            )}
                        </div>
                        <WorkspaceButton
                            variant="ghost"
                            size="icon-compact"
                            onClick={handleCancel}
                            aria-label="Close"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2.2} />
                        </WorkspaceButton>
                    </div>

                    {editing ? (
                        /* ── Edit mode ── */
                        <div className="space-y-2">
                            <div>
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">Date</label>
                                <Input
                                    type="date"
                                    value={eventDate}
                                    onChange={(e) => setEventDate(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 h-10 md:h-12 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                    Title
                                </label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                    Description
                                </label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs md:text-base font-bold text-(--theme-text) uppercase">
                                    All Day
                                </label>
                                <Switch
                                    checked={isAllDay}
                                    onCheckedChange={setIsAllDay}
                                    className="data-[state=checked]:bg-(--theme-sidebar) scale-90 md:scale-100"
                                />
                            </div>
                            {!isAllDay && (
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                            Start
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                onClick={(e) => {
                                                    if ("showPicker" in HTMLInputElement.prototype) {
                                                        try {
                                                            e.currentTarget.showPicker();
                                                        } catch {
                                                            // ignore
                                                        }
                                                    }
                                                }}
                                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden cursor-pointer pl-3"
                                            />
                                            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                            End
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                onClick={(e) => {
                                                    if ('showPicker' in HTMLInputElement.prototype) {
                                                        try {
                                                            e.currentTarget.showPicker();
                                                        } catch {
                                                            // ignore
                                                        }
                                                    }
                                                }}
                                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden cursor-pointer pl-3"
                                            />
                                            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                    Color
                                </label>
                                <div className="flex gap-2">
                                    {["#FEC435", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD"].map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={cn(
                                                "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                                                color === c ? "border-(--theme-text) scale-110" : "border-transparent"
                                            )}
                                            style={{ backgroundColor: c }}
                                            type="button"
                                            aria-label={`Select color ${c}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="pt-2">
                                <WorkspaceButton
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full"
                                >
                                    {saving ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Spinner />
                                            <span>Saving…</span>
                                        </div>
                                    ) : (
                                        "Save changes"
                                    )}
                                </WorkspaceButton>
                            </div>
                        </div>
                    ) : (
                        /* ── Read-only mode ── */
                        <div className="space-y-2">
                            <h2 className="text-lg md:text-2xl font-bold text-(--theme-text) uppercase">
                                {displayEvent.title}
                            </h2>
                            <p className="text-sm md:text-lg text-(--theme-text) opacity-60">
                                {dateStr}
                            </p>
                            {displayEvent.isAllDay ? (
                                <p className="text-sm md:text-lg font-medium text-(--theme-text)">All day</p>
                            ) : (displayEvent.startTime || displayEvent.endTime) ? (
                                <p className="text-sm md:text-lg font-medium text-(--theme-text)">
                                    {displayEvent.startTime ?? ""}
                                    {displayEvent.endTime ? ` – ${displayEvent.endTime}` : ""}
                                </p>
                            ) : null}
                            {displayEvent.description && (
                                <p className="text-sm md:text-base text-(--theme-text) opacity-80">
                                    {displayEvent.description}
                                </p>
                            )}
                            {displayEvent.isProtected && (
                                <div className="flex items-center gap-2 pt-3 text-xs font-bold text-(--theme-text) opacity-50">
                                    <LockKeyhole className="h-4 w-4" />
                                    {displayEvent.canEdit === false ? "Managed by your teacher" : "Synchronized with Classroom"}
                                </div>
                            )}
                            <div className="mt-4 border-t border-(--theme-text)/10 pt-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-start gap-2.5">
                                        <div className="rounded-xl bg-(--theme-sidebar) p-2"><BellRing className="h-4 w-4 text-(--theme-text)" /></div>
                                        <div><p className="text-xs font-bold uppercase text-(--theme-text)">Event reminder</p><p className="mt-0.5 text-[11px] leading-4 text-(--theme-text)/60">{reminderNotifications ? "Get an in-app notification before this event." : "Reminder notifications are off in Settings."}</p></div>
                                    </div>
                                    <Switch checked={reminderEnabled} disabled={!reminderNotifications && !reminderEnabled} onCheckedChange={setReminderEnabled} aria-label="Event reminder" />
                                </div>
                                {reminderEnabled && <div className="mt-3 grid grid-cols-2 gap-2"><Input type="date" aria-label="Reminder date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} className="h-10 rounded-xl bg-(--theme-sidebar)" /><Input type="time" aria-label="Reminder time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} className="h-10 rounded-xl bg-(--theme-sidebar)" /></div>}
                                <WorkspaceButton type="button" variant={reminderEnabled ? "primary" : "secondary"} onClick={handleSaveReminder} disabled={savingReminder || (reminderEnabled && !reminderNotifications) || (!reminderEnabled && !displayEvent.reminder)} className="mt-3 w-full">{savingReminder ? "Saving…" : reminderEnabled ? displayEvent.reminder ? "Update reminder" : "Set reminder" : displayEvent.reminder ? "Remove reminder" : "No reminder"}</WorkspaceButton>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>


            <DeleteConfirmationModal
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={deleting}
            />
        </Dialog >
    );
}
