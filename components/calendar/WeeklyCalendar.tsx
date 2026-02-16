"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FancyButton } from "@/components/ui/fancybutton";
import { FancyCard } from "@/components/ui/fancycard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EventData {
    id: string;
    title: string;
    startDate: string; // YYYY-MM-DD
    startTime?: string | null; // HH:mm
    endTime?: string | null; // HH:mm
    isAllDay: boolean;
    color?: string; // Optional color for the event block
}

interface WeeklyCalendarProps {
    events?: EventData[];
    onDateChange?: (startDate: Date, endDate: Date) => void;
    onEventClick?: (event: EventData) => void;
    onTimeRangeSelect?: (date: Date, startTime: string, endTime: string) => void;
}

export function WeeklyCalendar({ events = [], onDateChange, onEventClick, onTimeRangeSelect }: WeeklyCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ day: Date, y: number } | null>(null);
    const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);

    // Calculate the start of the current week (Monday)
    const getStartOfWeek = (date: Date) => {
        const day = date.getDay(); // 0 (Sun) to 6 (Sat)
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const start = new Date(date);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        return start;
    };

    const [startOfWeek, setStartOfWeek] = useState(() => getStartOfWeek(new Date()));

    // Notify parent of date range change
    useEffect(() => {
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        onDateChange?.(startOfWeek, endOfWeek);
    }, [startOfWeek, onDateChange]);

    const handlePrevWeek = () => {
        const newDate = new Date(startOfWeek);
        newDate.setDate(startOfWeek.getDate() - 7);
        setStartOfWeek(newDate);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(startOfWeek);
        newDate.setDate(startOfWeek.getDate() + 7);
        setStartOfWeek(newDate);
        setCurrentDate(newDate);
    };

    const handleToday = () => {
        const today = new Date();
        setStartOfWeek(getStartOfWeek(today));
        setCurrentDate(today);
    };

    // Generate days of the week for header
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        return date;
    });

    // Time slots (e.g., 0:00 to 23:00)
    const startHour = 0;
    const endHour = 23;
    const timeSlots = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    const PIXELS_per_HOUR = 80;

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
            if (viewport) {
                viewport.scrollTop = 8 * PIXELS_per_HOUR;
            }
        }
    }, [PIXELS_per_HOUR]);

    // Helper to check if a date is today
    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    // Helper to format date for comparison
    const formatDateKey = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // Filter events for the displayed week
    const getAllDayEventsForDay = (date: Date) => {
        const dateKey = formatDateKey(date);
        return events.filter(event => {
            if (!event.startDate) return false;
            // Handle both exact match and ISO strings and check for all-day flag
            return event.isAllDay && event.startDate.toString().startsWith(dateKey);
        });
    };

    const getTimeEventsForDay = (date: Date) => {
        const dateKey = formatDateKey(date);
        return events.filter(event => {
            if (!event.startDate) return false;
            // Handle both exact match and ISO strings and exclude all-day events
            return !event.isAllDay && event.startDate.toString().startsWith(dateKey);
        });
    };

    // Calculate position and height for an event block
    const getEventStyle = (event: EventData) => {
        if (event.isAllDay || !event.startTime) {
            return { top: 0, height: '2rem', position: 'relative' as const }; // Fallback for all-day/no-time
        }

        const [startH, startM] = event.startTime.split(':').map(Number);
        let durationMinutes = 60; // Default 1 hour

        if (event.endTime) {
            const [endH, endM] = event.endTime.split(':').map(Number);
            durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        }

        // Calculate position relative to startHour
        // height of one hour slot is e.g., 60px (h-16 = 4rem = 64px roughly? Tailwind h-20 is 5rem=80px)
        // Let's assume h-20 (80px) per hour for better visibility
        const minutesFromStart = (startH - startHour) * 60 + startM;

        const top = (minutesFromStart / 60) * PIXELS_per_HOUR;
        const height = (durationMinutes / 60) * PIXELS_per_HOUR;

        // console.log(`Event style for ${event.id}: top=${top}, height=${height}`);

        return {
            top: `${top}px`,
            height: `${Math.max(height, 30)}px`, // Minimum height
            position: 'absolute' as const,
            left: '4px',
            right: '4px',
        };
    };

    // --- Interaction Handlers ---

    const getTimeFromY = (y: number) => {
        // Snap to nearest 15 minutes? Or just raw.
        // Let's snap to 15 minutes (1/4 of hour = 20px)
        const totalMinutes = (y / PIXELS_per_HOUR) * 60;
        const snappedMinutes = Math.round(totalMinutes / 15) * 15;

        let hour = startHour + Math.floor(snappedMinutes / 60);
        let minute = snappedMinutes % 60;

        // Clamp
        if (hour < startHour) { hour = startHour; minute = 0; }
        if (hour > endHour) { hour = endHour; minute = 0; }

        return { hour, minute };
    };

    const formatTime = (h: number, m: number) => {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const handleMouseDown = (e: React.MouseEvent, day: Date) => {
        // Only trigger on left click
        if (e.button !== 0) return;

        e.preventDefault(); // Prevent text selection
        const rect = e.currentTarget.getBoundingClientRect();
        // e.clientY - rect.top gives Y relative to viewport visible area of the element.
        setDragStart({ day, y: e.clientY - rect.top });
        setDragCurrentY(e.clientY - rect.top);
        setIsDragging(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragStart) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        setDragCurrentY(y);
    };

    const handleMouseUp = () => {
        if (!isDragging || !dragStart || dragCurrentY === null) {
            setIsDragging(false);
            setDragStart(null);
            setDragCurrentY(null);
            return;
        }

        const startY = Math.min(dragStart.y, dragCurrentY);
        const endY = Math.max(dragStart.y, dragCurrentY);

        // If 'click' (very small movement), default to 1 hour
        let startObj = getTimeFromY(startY);
        let endObj = getTimeFromY(endY);

        // Ensure at least 15 mins block if drag was tiny
        const startMins = startObj.hour * 60 + startObj.minute;
        const endMins = endObj.hour * 60 + endObj.minute;

        if (endMins - startMins < 15) {
            endObj = getTimeFromY(startY + (PIXELS_per_HOUR / 4)); // +15 mins
            // Or default to 1 hour if simple click
            if (Math.abs(dragCurrentY - dragStart.y) < 10) {
                endObj = getTimeFromY(startY + PIXELS_per_HOUR); // +1 hour for click
            }
        }

        const startTime = formatTime(startObj.hour, startObj.minute);
        const endTime = formatTime(endObj.hour, endObj.minute);

        onTimeRangeSelect?.(dragStart.day, startTime, endTime);

        setIsDragging(false);
        setDragStart(null);
        setDragCurrentY(null);
    };

    // Render ghost event
    const renderGhostEvent = (day: Date) => {
        if (!isDragging || !dragStart || !dragCurrentY || dragStart.day.getTime() !== day.getTime()) return null;

        const startY = Math.min(dragStart.y, dragCurrentY);
        const endY = Math.max(dragStart.y, dragCurrentY);
        const height = Math.max(endY - startY, 20); // Min visual height

        return (
            <div
                className="absolute bg-(--theme-text) opacity-30 rounded-md z-20 pointer-events-none"
                style={{
                    top: startY,
                    height: height,
                    left: '4px',
                    right: '4px'
                }}
            />
        );
    };

    return (
        <FancyCard className="h-full bg-(--theme-sidebar)">
            <div className="flex flex-col h-full p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 w-full">
                    <div className="flex items-center gap-4 w-full ">
                        <h2 className="text-2xl font-bold text-(--theme-text) w-full">
                            {startOfWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="flex w-full justify-end items-center gap-2">
                            <FancyCard className="p-2 bg-(--theme-bg)">
                                <div className="flex items-center gap-2">
                                    <FancyButton onClick={handlePrevWeek} className="h-8 w-8 p-0 bg-(--theme-card) hover:bg-(--theme-bg) text-(--theme-text)">
                                        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                                    </FancyButton>
                                    <FancyButton onClick={handleToday} className="bg-(--theme-card) hover:bg-(--theme-bg) text-md font-medium text-(--theme-text)">
                                        Today
                                    </FancyButton>
                                    <FancyButton onClick={handleNextWeek} className="h-8 w-8 p-0 bg-(--theme-card) hover:bg-(--theme-bg) text-(--theme-text)">
                                        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                                    </FancyButton>
                                </div>
                            </FancyCard>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div ref={scrollRef} className="flex-1 min-h-0 border border-(--theme-card) bg-(--theme-bg)/50 rounded-xl overflow-hidden flex flex-col">
                    {/* Days Header */}
                    <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-(--theme-card) bg-(--theme-bg) z-10 ring-1 ring-(--theme-card)/10 shrink-0">
                        <div className="p-4 border-r border-(--theme-card)"></div> {/* Time col header */}
                        {weekDays.map((day, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "p-2 md:p-4 text-center border-r border-(--theme-card) last:border-r-0 overflow-hidden",
                                    isToday(day) && "bg-(--theme-card)/30"
                                )}
                            >
                                <div className={cn("text-[10px] md:text-xs uppercase font-semibold mb-1 truncate", isToday(day) ? "text-(--theme-text)" : "text-muted-foreground")}>
                                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={cn(
                                    "text-lg md:text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                                    isToday(day) ? "bg-(--theme-text) text-(--theme-bg)" : "text-(--theme-text)"
                                )}>
                                    {day.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* All Day Row */}
                    <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-(--theme-card) bg-(--theme-bg) shrink-0">
                        <div className="p-2 text-[10px] md:text-xs font-semibold text-muted-foreground text-right border-r border-(--theme-card) flex items-center justify-end">
                            All Day
                        </div>
                        {weekDays.map((day, index) => {
                            const dayEvents = getAllDayEventsForDay(day);
                            return (
                                <div key={index} className="p-1 border-r border-(--theme-card) last:border-r-0 min-h-[40px] flex flex-col gap-1">
                                    {dayEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEventClick?.(event);
                                            }}
                                            style={{ backgroundColor: event.color || '#FEC435' }}
                                            className="rounded-md px-2 py-1 text-[10px] md:text-xs font-bold text-black cursor-pointer shadow-sm hover:brightness-95 truncate z-10"
                                        >
                                            {event.title}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    <ScrollArea className="flex-1 w-full overflow-hidden">
                        <div className="flex flex-col min-w-0" onMouseLeave={() => { if (isDragging) setIsDragging(false); }}>

                            {/* Time Slots Area */}
                            <div className="relative">
                                {/* Background Grid */}
                                <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr_1fr_1fr]">
                                    {/* Time labels column */}
                                    <div className="border-r border-(--theme-card)">
                                        {timeSlots.map((hour) => (
                                            <div key={hour} className="h-20 border-b border-(--theme-card) text-xs text-muted-foreground p-2 text-right">
                                                {`${hour}:00`}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Day columns */}
                                    {weekDays.map((day, dayIndex) => (
                                        <div
                                            key={dayIndex}
                                            className="relative border-r border-(--theme-card) last:border-r-0 cursor-crosshair"
                                            onMouseDown={(e) => handleMouseDown(e, day)}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                        >
                                            {/* Ghost Event */}
                                            {renderGhostEvent(day)}

                                            {/* Hour lines within day */}
                                            {timeSlots.map((hour) => (
                                                <div key={hour} className="h-20 border-b border-(--theme-card) pointer-events-none"></div>
                                            ))}

                                            {/* Events for this day */}
                                            {getTimeEventsForDay(day).map((event) => {
                                                // Render all events including all-day
                                                return (
                                                    <div
                                                        key={event.id}
                                                        style={{
                                                            ...getEventStyle(event),
                                                            backgroundColor: event.color || '#FEC435'
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent creation trigger when clicking existing event
                                                            onEventClick?.(event);
                                                        }}
                                                        className="absolute rounded-md cursor-pointer shadow-md transition-all z-50 group hover:brightness-95 border-l-4 border-black/20"
                                                    >
                                                        <div className="p-1 md:p-2 w-full h-full overflow-hidden text-black text-xs">
                                                            <div className="font-bold truncate">{event.title}</div>
                                                            {event.startTime && (
                                                                <div className="hidden md:block opacity-75 truncate text-[10px]">{event.startTime} - {event.endTime || ''}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </FancyCard>
    );
}
