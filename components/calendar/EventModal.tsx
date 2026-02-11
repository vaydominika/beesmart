"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Trash2 } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventData {
    id: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay: boolean;
}

interface EventModalProps {
    open: boolean;
    onClose: () => void;
    selectedDate: Date;
    onEventsChanged: () => void;
}

function SortableEventItem({
    event,
    onDelete,
    onDragEnd,
}: {
    event: EventData;
    onDelete: (id: string) => void;
    onDragEnd: () => void;
}) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={event}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            className="flex items-center justify-between bg-(--theme-sidebar) rounded-xl corner-squircle p-3 mb-2"
        >
            <div
                className="cursor-move p-2 -ml-2 text-(--theme-text) opacity-50 hover:opacity-100 touch-none"
                onPointerDown={(e) => controls.start(e)}
            >
                <HugeiconsIcon icon={DragDropVerticalIcon} size={20} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1 ml-1 select-none">
                <p className="text-sm md:text-base font-bold text-(--theme-text) truncate">
                    {event.title}
                </p>
                {event.isAllDay ? (
                    <p className="text-xs text-(--theme-text) opacity-70">All day</p>
                ) : event.startTime ? (
                    <p className="text-xs text-(--theme-text) opacity-70">
                        {event.startTime}
                        {event.endTime ? ` – ${event.endTime}` : ""}
                    </p>
                ) : null}
            </div>
            <button
                onClick={() => onDelete(event.id)}
                className="ml-2 p-1.5 rounded-lg hover:bg-(--theme-card)/50 text-(--theme-text) opacity-60 hover:opacity-100 transition-opacity shrink-0"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </Reorder.Item>
    );
}

export function EventModal({ open, onClose, selectedDate, onEventsChanged }: EventModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [isAllDay, setIsAllDay] = useState(false);
    const [saving, setSaving] = useState(false);
    const [events, setEvents] = useState<EventData[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    const dateStr = selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const fetchEventsForDate = useCallback(async () => {
        setLoadingEvents(true);
        try {
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const res = await fetch(`/api/user/events?month=${y}-${m}`);
            if (!res.ok) return;
            const all: EventData[] = await res.json();
            // Filter to the selected date
            const dayStr = `${y}-${m}-${String(selectedDate.getDate()).padStart(2, "0")}`;
            const filtered = all.filter((e) => e.startDate.slice(0, 10) === dayStr);
            setEvents(filtered);
        } catch {
            // ignore
        } finally {
            setLoadingEvents(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        if (open) {
            fetchEventsForDate();
            setTitle("");
            setDescription("");
            setStartTime("");
            setEndTime("");
            setIsAllDay(false);
        }
    }, [open, fetchEventsForDate]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Please enter a title.");
            return;
        }
        setSaving(true);
        try {
            const y = selectedDate.getFullYear();
            const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
            const d = String(selectedDate.getDate()).padStart(2, "0");
            const startDate = `${y}-${m}-${d}T00:00:00.000Z`;

            const res = await fetch("/api/user/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    startDate,
                    startTime: isAllDay ? null : startTime || null,
                    endTime: isAllDay ? null : endTime || null,
                    isAllDay,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Failed to create event.");
                return;
            }
            toast.success("Event created!");
            setTitle("");
            setDescription("");
            setStartTime("");
            setEndTime("");
            setIsAllDay(false);
            await fetchEventsForDate();
            // Small delay to ensure DB propagation before parent refetch
            setTimeout(() => {
                onEventsChanged();
            }, 100);
        } catch {
            toast.error("Failed to create event.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/user/events?id=${id}`, { method: "DELETE" });
            if (!res.ok) {
                toast.error("Failed to delete event.");
                return;
            }
            toast.success("Event deleted.");
            await fetchEventsForDate();
            // Small delay to ensure DB propagation before parent refetch
            setTimeout(() => {
                onEventsChanged();
            }, 50);
        } catch {
            toast.error("Failed to delete event.");
        }
    };

    const handleReorder = (newOrder: EventData[]) => {
        setEvents(newOrder); // Optimistic update
    };

    const handleDragEnd = async () => {
        // Save new order to backend
        try {
            const updates = events.map((event, index) => ({
                id: event.id,
                order: index,
            }));

            await fetch("/api/user/events", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            // Notify parent to refresh reminders
            setTimeout(() => {
                onEventsChanged();
            }, 50);
        } catch {
            toast.error("Failed to save order.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg max-h-[95vh] overflow-hidden border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            {dateStr}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Existing events for this date */}
                    {loadingEvents ? (
                        <p className="text-sm text-(--theme-text) py-2">Loading…</p>
                    ) : events.length > 0 ? (
                        <ScrollArea className="mb-4 max-h-20 pr-2 overflow-y-auto">
                            <Reorder.Group
                                axis="y"
                                values={events}
                                onReorder={handleReorder}
                                className="space-y-2"
                            >
                                {events.map((event) => (
                                    <SortableEventItem
                                        key={event.id}
                                        event={event}
                                        onDelete={handleDelete}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))}
                            </Reorder.Group>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-(--theme-text) opacity-60 mb-4">No events for this day.</p>
                    )}

                    {/* Add event form */}
                    <div className="space-y-3 flex-1">
                        <div>
                            <label className="block text-sm md:text-[22px] font-bold text-(--theme-text) uppercase mb-3">
                                Title
                            </label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-base md:text-[28px] font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-16 w-full"
                                placeholder="Event title"
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
                    </div>

                    <div className="flex gap-3 pt-4 shrink-0">
                        <FancyButton
                            onClick={onClose}
                            className="flex-1 text-(--theme-text) text-xs md:text-[28px] font-bold uppercase"
                        >
                            Cancel
                        </FancyButton>
                        <FancyButton
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 text-(--theme-text) text-xs md:text-[28px] font-bold uppercase"
                        >
                            {saving ? "Saving…" : "Add Event"}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
