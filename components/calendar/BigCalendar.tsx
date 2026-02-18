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

type CalendarView = 'week' | 'month' | 'year';

export function BigCalendar({ events = [], onDateChange, onEventClick, onTimeRangeSelect }: WeeklyCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>('week');

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

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (view === 'week') {
            newDate.setDate(currentDate.getDate() - 7);
            setStartOfWeek(getStartOfWeek(newDate));
        } else if (view === 'month') {
            newDate.setMonth(currentDate.getMonth() - 1);
        } else if (view === 'year') {
            newDate.setFullYear(currentDate.getFullYear() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (view === 'week') {
            newDate.setDate(currentDate.getDate() + 7);
            setStartOfWeek(getStartOfWeek(newDate));
        } else if (view === 'month') {
            newDate.setMonth(currentDate.getMonth() + 1);
        } else if (view === 'year') {
            newDate.setFullYear(currentDate.getFullYear() + 1);
        }
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
                            {view === 'week'
                                ? startOfWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                            }
                        </h2>
                        <div className="flex w-full justify-end items-center gap-2">
                            <FancyCard className="p-2 bg-(--theme-bg)">
                                <div className="flex items-center gap-2">
                                    <FancyButton
                                        onClick={() => setView('year')}
                                        className={cn(
                                            "px-3 py-1 text-sm font-medium bg-(--theme-card) text-(--theme-text) hover:bg-(--theme-bg)",
                                            view === 'year' && "bg-(--theme-text) text-(--theme-bg) hover:bg-(--theme-text)/90"
                                        )}
                                    >
                                        Year
                                    </FancyButton>
                                    <FancyButton
                                        onClick={() => setView('month')}
                                        className={cn(
                                            "px-3 py-1 text-sm font-medium bg-(--theme-card) text-(--theme-text) hover:bg-(--theme-bg)",
                                            view === 'month' && "bg-(--theme-text) text-(--theme-bg) hover:bg-(--theme-text)/90"
                                        )}
                                    >
                                        Month
                                    </FancyButton>
                                    <FancyButton
                                        onClick={() => setView('week')}
                                        className={cn(
                                            "px-3 py-1 text-sm font-medium bg-(--theme-card) text-(--theme-text) hover:bg-(--theme-bg)",
                                            view === 'week' && "bg-(--theme-text) text-(--theme-bg) hover:bg-(--theme-text)/90"
                                        )}
                                    >
                                        Week
                                    </FancyButton>
                                </div>
                            </FancyCard>

                            <FancyCard className="p-2 bg-(--theme-bg)">
                                <div className="flex items-center gap-2">
                                    <FancyButton onClick={handlePrev} className="w-8 p-1 bg-(--theme-card) hover:bg-(--theme-bg) text-(--theme-text)">
                                        <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                                    </FancyButton>
                                    <FancyButton onClick={handleToday} className="px-3 py-1 text-sm font-medium bg-(--theme-card) hover:bg-(--theme-bg) text-(--theme-text)">
                                        Today
                                    </FancyButton>
                                    <FancyButton onClick={handleNext} className="w-8 p-1 bg-(--theme-card) hover:bg-(--theme-bg) text-(--theme-text)">
                                        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                                    </FancyButton>
                                </div>
                            </FancyCard>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div ref={scrollRef} className="flex-1 min-h-0 border border-(--theme-card) bg-(--theme-bg)/50 rounded-xl overflow-hidden flex flex-col">
                    {view === 'week' && (
                        <>
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
                                                    className="rounded-md px-2 py-1 text-[10px] md:text-xs font-bold text-black cursor-pointer hover:brightness-95 truncate z-10"
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
                                                                    backgroundColor: event.color || 'var(--theme-card)'
                                                                }}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent creation trigger when clicking existing event
                                                                    onEventClick?.(event);
                                                                }}
                                                                className="absolute rounded-xl corner-squircle cursor-pointer transition-all z-50 group hover:brightness-95 border-l-4 border-black/20"
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
                        </>
                    )}

                    {view === 'month' && (
                        <div className="h-full flex flex-col">
                            {/* Weekday Headers */}
                            <div className="grid grid-cols-7 border-b border-(--theme-card) bg-(--theme-bg) shrink-0">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <div key={day} className="p-3 text-center text-sm font-bold text-(--theme-text)/60 uppercase tracking-wider border-r border-(--theme-card) last:border-r-0">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 grid grid-cols-7 grid-rows-6">
                                {(() => {
                                    const year = currentDate.getFullYear();
                                    const month = currentDate.getMonth();
                                    const firstDay = new Date(year, month, 1);
                                    const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    const totalSlots = 42; // 6 rows * 7 cols

                                    const days = [];

                                    // Prev month days
                                    const prevMonthLastDate = new Date(year, month, 0).getDate();
                                    for (let i = startingDay - 1; i >= 0; i--) {
                                        days.push({ day: prevMonthLastDate - i, currentMonth: false, date: new Date(year, month - 1, prevMonthLastDate - i) });
                                    }

                                    // Current month days
                                    for (let i = 1; i <= daysInMonth; i++) {
                                        days.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
                                    }

                                    // Next month days
                                    const remainingSlots = totalSlots - days.length;
                                    for (let i = 1; i <= remainingSlots; i++) {
                                        days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
                                    }

                                    return days.map((item, idx) => {
                                        const eventsForDay = events.filter(e => e.startDate === formatDateKey(item.date));
                                        return (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "border-b border-r border-(--theme-card) p-1 flex flex-col gap-1 transition-colors hover:bg-(--theme-card)/10 min-h-0 overflow-hidden cursor-pointer",
                                                    (idx + 1) % 7 === 0 && "border-r-0",
                                                    !item.currentMonth && "bg-(--theme-bg)/30 opacity-50",
                                                    item.currentMonth && "bg-(--theme-bg)"
                                                )}
                                                onClick={() => {
                                                    // On click, switch to week view for this day? or open creation?
                                                    // Let's go to week view matching this date
                                                    const newStart = getStartOfWeek(item.date);
                                                    setStartOfWeek(newStart);
                                                    setCurrentDate(item.date);
                                                    setView('week');
                                                }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span
                                                        className={cn(
                                                            "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                                                            isToday(item.date) ? "bg-(--theme-text) text-(--theme-bg)" : "text-(--theme-text)/70"
                                                        )}
                                                    >
                                                        {item.day}
                                                    </span>
                                                </div>
                                                <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                                                    {eventsForDay.map(event => (
                                                        <div
                                                            key={event.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEventClick?.(event);
                                                            }}
                                                            style={{ backgroundColor: event.color || '#FEC435' }}
                                                            className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-sm font-semibold truncate text-black shrink-0"
                                                        >
                                                            {event.title}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}

                    {view === 'year' && (
                        <ScrollArea className="h-full">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
                                {Array.from({ length: 12 }).map((_, monthIndex) => {
                                    const year = currentDate.getFullYear();
                                    const firstDay = new Date(year, monthIndex, 1);
                                    const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                                    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                                    const monthName = firstDay.toLocaleDateString('en-US', { month: 'long' });

                                    return (
                                        <div
                                            key={monthIndex}
                                            className="bg-(--theme-bg) rounded-xl p-4 border border-(--theme-card) hover:border-(--theme-text)/20 transition-colors cursor-pointer"
                                            onClick={() => {
                                                const newDate = new Date(year, monthIndex, 1);
                                                setCurrentDate(newDate);
                                                setView('month');
                                            }}
                                        >
                                            <h3 className="text-lg font-bold text-(--theme-text) mb-3 text-center uppercase">{monthName}</h3>
                                            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                                    <div key={i} className="text-[10px] text-(--theme-text)/50 font-bold">{d}</div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1 text-center">
                                                {Array.from({ length: startingDay }).map((_, i) => (
                                                    <div key={`empty-${i}`} />
                                                ))}
                                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                                    const day = i + 1;
                                                    const date = new Date(year, monthIndex, day);
                                                    const isTodayDate = isToday(date);

                                                    // Simple event check
                                                    const hasEvent = events.some(e => e.startDate === formatDateKey(date));

                                                    return (
                                                        <div
                                                            key={day}
                                                            className={cn(
                                                                "h-6 w-6 flex items-center justify-center rounded-full text-xs font-medium mx-auto",
                                                                isTodayDate && "bg-(--theme-text) text-(--theme-bg) font-bold",
                                                                hasEvent && !isTodayDate && "font-extrabold text-(--theme-text)",
                                                                !hasEvent && !isTodayDate && "text-(--theme-text)/80"
                                                            )}
                                                        >
                                                            {day}
                                                            {hasEvent && !isTodayDate && (
                                                                <div className="absolute w-1 h-1 bg-(--theme-secondary) rounded-full transform translate-y-2.5" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </div>
        </FancyCard>
    );
}
