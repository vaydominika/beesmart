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
import { Trash2, Clock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface EventData {
    id: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay: boolean;
    color?: string | null;
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
    const [color, setColor] = useState(event.color || "#FEC435");

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

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this event?")) {
            try {
                const res = await fetch(`/api/user/events?id=${event.id}`, { method: "DELETE" });
                if (!res.ok) {
                    toast.error("Failed to delete event.");
                    return;
                }
                toast.success("Event deleted.");
                onClose();
                // Small delay to ensure DB propagation before parent refetch
                setTimeout(() => {
                    onEventUpdated();
                }, 100);
            } catch {
                toast.error("Failed to delete event.");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none [&>button]:hidden">
                <DialogTitle className="sr-only">Event Details</DialogTitle>
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                    {/* Top bar: pencil left, cancel right */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                            <button
                                onClick={handleEdit}
                                className="p-2 rounded-lg hover:bg-(--theme-sidebar) text-(--theme-text) transition-colors"
                                aria-label="Edit event"
                            >
                                <HugeiconsIcon icon={Pen01Icon} size={20} strokeWidth={2.2} />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 rounded-lg hover:bg-(--theme-sidebar) text-(--theme-text) transition-colors"
                                aria-label="Delete event"
                            >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2.2} />
                            </button>
                        </div>
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
                        <div className="space-y-2">
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
                                                            (e.currentTarget as any).showPicker();
                                                        } catch (err) {
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
                                                        } catch (err) {
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
                                <FancyButton
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full text-(--theme-text) text-xs md:text-xl font-bold uppercase"
                                >
                                    {saving ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Spinner />
                                            <span>Saving…</span>
                                        </div>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </FancyButton>
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
                        </div>
                    )}
                </FancyCard>
            </DialogContent>
        </Dialog >
    );
}
