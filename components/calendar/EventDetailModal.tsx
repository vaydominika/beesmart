"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Pen01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

interface EventData {
    id: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay: boolean;
}

interface EventDetailModalProps {
    open: boolean;
    onClose: () => void;
    event: EventData;
    onEventUpdated: () => void;
}

export function EventDetailModal({ open, onClose, event, onEventUpdated }: EventDetailModalProps) {
    const [displayEvent, setDisplayEvent] = useState(event);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit state
    const [title, setTitle] = useState(event.title);
    const [description, setDescription] = useState(event.description ?? "");
    const [startTime, setStartTime] = useState(event.startTime ?? "");
    const [endTime, setEndTime] = useState(event.endTime ?? "");
    const [isAllDay, setIsAllDay] = useState(event.isAllDay);

    // Format date for display
    const d = new Date(displayEvent.startDate);
    const dateStr = `${d.getFullYear()}. ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}. ${d.toLocaleDateString("en-US", { weekday: "long" })}`;

    const handleEdit = () => {
        setTitle(displayEvent.title);
        setDescription(displayEvent.description ?? "");
        setStartTime(displayEvent.startTime ?? "");
        setEndTime(displayEvent.endTime ?? "");
        setIsAllDay(displayEvent.isAllDay);
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
            onEventUpdated();
        } catch {
            toast.error("Failed to update event.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none [&>button]:hidden">
                <DialogTitle className="sr-only">Event Details</DialogTitle>
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                    {/* Top bar: pencil left, cancel right */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handleEdit}
                            className="p-2 rounded-lg hover:bg-(--theme-sidebar) text-(--theme-text) transition-colors"
                            aria-label="Edit event"
                        >
                            <HugeiconsIcon icon={Pen01Icon} size={20} strokeWidth={2.2} />
                        </button>
                        <button
                            onClick={handleCancel}
                            className="p-2 rounded-lg hover:bg-(--theme-sidebar) text-(--theme-text) transition-colors"
                            aria-label="Close"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2.2} />
                        </button>
                    </div>

                    {editing ? (
                        /* ── Edit mode ── */
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                                    Title
                                </label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                                    Description
                                </label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm md:text-[22px] font-bold text-(--theme-text) uppercase">
                                    All Day
                                </label>
                                <Switch
                                    checked={isAllDay}
                                    onCheckedChange={setIsAllDay}
                                    className="data-[state=checked]:bg-(--theme-sidebar) scale-110"
                                />
                            </div>
                            {!isAllDay && (
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                                            Start
                                        </label>
                                        <Input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                                            End
                                        </label>
                                        <Input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="pt-2">
                                <FancyButton
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full text-(--theme-text) text-xs md:text-[28px] font-bold uppercase"
                                >
                                    {saving ? "Saving…" : "Save Changes"}
                                </FancyButton>
                            </div>
                        </div>
                    ) : (
                        /* ── Read-only mode ── */
                        <div className="space-y-4">
                            <h2 className="text-xl md:text-[36px] font-bold text-(--theme-text) uppercase">
                                {displayEvent.title}
                            </h2>
                            <p className="text-base md:text-[22px] text-(--theme-text) opacity-60">
                                {dateStr}
                            </p>
                            {displayEvent.isAllDay ? (
                                <p className="text-base md:text-[22px] font-medium text-(--theme-text)">All day</p>
                            ) : (displayEvent.startTime || displayEvent.endTime) ? (
                                <p className="text-base md:text-[22px] font-medium text-(--theme-text)">
                                    {displayEvent.startTime ?? ""}
                                    {displayEvent.endTime ? ` – ${displayEvent.endTime}` : ""}
                                </p>
                            ) : null}
                            {displayEvent.description && (
                                <p className="text-base md:text-[18px] text-(--theme-text) opacity-80">
                                    {displayEvent.description}
                                </p>
                            )}
                        </div>
                    )}
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
