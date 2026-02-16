"use client";

import { useState, useEffect, useCallback } from "react";
import { WeeklyCalendar } from "@/components/calendar/WeeklyCalendar";
import { EventDetailModal } from "@/components/calendar/EventDetailModal";

interface EventData {
    id: string;
    title: string;
    description?: string | null;
    startDate: string;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay: boolean;
}

import { useEventSync } from "@/hooks/use-event-sync";

// ... imports

import { EventModal } from "@/components/calendar/EventModal";

export default function SchedulePage() {
    const [events, setEvents] = useState<EventData[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
    const [creationModalOpen, setCreationModalOpen] = useState(false);
    const [creationData, setCreationData] = useState<{ date: Date, start: string, end: string } | null>(null);

    const fetchEvents = useCallback(async (start: Date, end: Date) => {
        // ... (fetch implementation same as before)
        try {
            const year = start.getFullYear();
            const month = String(start.getMonth() + 1).padStart(2, '0');
            const currentMonth = `${year}-${month}`;

            const res = await fetch(`/api/user/events?month=${currentMonth}&ts=${Date.now()}`, {
                cache: "no-store",
                headers: { "Pragma": "no-cache" }
            });

            if (res.ok) {
                const data = await res.json();
                setEvents(data);

                if (end.getMonth() !== start.getMonth()) {
                    const nextMonthYear = end.getFullYear();
                    const nextMonth = String(end.getMonth() + 1).padStart(2, '0');
                    const nextMonthStr = `${nextMonthYear}-${nextMonth}`;

                    const res2 = await fetch(`/api/user/events?month=${nextMonthStr}&ts=${Date.now()}`, {
                        cache: "no-store",
                        headers: { "Pragma": "no-cache" }
                    });
                    if (res2.ok) {
                        const data2 = await res2.json();
                        setEvents(prev => {
                            const existingIds = new Set(prev.map(e => e.id));
                            const newData = data2.filter((e: EventData) => !existingIds.has(e.id));
                            return [...prev, ...newData];
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch events", error);
        }
    }, []);

    const handleSyncUpdate = useCallback(() => {
        if (dateRange) {
            fetchEvents(dateRange.start, dateRange.end);
        }
    }, [dateRange, fetchEvents]);

    const { triggerUpdate } = useEventSync(handleSyncUpdate);

    const handleDateChange = useCallback((start: Date, end: Date) => {
        setDateRange({ start, end });
        fetchEvents(start, end);
    }, [fetchEvents]);

    const handleEventClick = useCallback((event: EventData) => {
        setSelectedEvent(event);
    }, []);

    const handleEventUpdated = useCallback(() => {
        triggerUpdate();
    }, [triggerUpdate]);

    const handleTimeRangeSelect = useCallback((date: Date, startTime: string, endTime: string) => {
        setCreationData({ date, start: startTime, end: endTime });
        setCreationModalOpen(true);
    }, []);

    const handleCreationModalClose = useCallback(() => {
        setCreationModalOpen(false);
        setCreationData(null);
    }, []);

    return (
        <div className="h-full p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-(--theme-text)">Schedule</h1>
                <p className="text-(--theme-text)/70">Manage your weekly classes and events.</p>
            </div>

            <div className="flex-1 min-h-0">
                <WeeklyCalendar
                    events={events}
                    onDateChange={handleDateChange}
                    onEventClick={handleEventClick}
                    onTimeRangeSelect={handleTimeRangeSelect}
                />
            </div>

            {selectedEvent && (
                <EventDetailModal
                    open={!!selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    event={selectedEvent}
                    onEventUpdated={handleEventUpdated}
                />
            )}

            {creationModalOpen && creationData && (
                <EventModal
                    open={creationModalOpen}
                    onClose={handleCreationModalClose}
                    selectedDate={creationData.date}
                    onEventsChanged={handleEventUpdated} // Reusing sync trigger
                    initialStartTime={creationData.start}
                    initialEndTime={creationData.end}
                />
            )}
        </div>
    );
}
