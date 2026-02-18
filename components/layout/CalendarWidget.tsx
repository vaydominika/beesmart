"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FancyButton } from "@/components/ui/fancybutton";
import { cn } from "@/lib/utils";

interface CalendarWidgetProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  highlightedDates?: Date[];
  onMonthChange?: (date: Date) => void;
}

export function CalendarWidget({
  selectedDate,
  onDateSelect,
  highlightedDates = [],
  onMonthChange,
}: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();
  // Adjust for Monday start (0=Sun -> 6, 1=Mon -> 0, etc.)
  // If startingDay is 0 (Sun), we want index 6. 
  // If startingDay is 1 (Mon), we want index 0.
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const goToToday = () => {
    const newDate = new Date();
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    onMonthChange?.(newDate);
  };

  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isHighlighted = (date: Date) => {
    return highlightedDates.some(
      (highlighted) =>
        date.toDateString() === highlighted.toDateString()
    );
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    onDateSelect?.(date);
  };

  const renderCalendarDays = () => {
    const days = [];
    const previousMonthDays = new Date(year, month, 0).getDate();
    // Number of days to show from previous month
    const daysToShowFromPreviousMonth = adjustedStartingDay;

    for (let i = daysToShowFromPreviousMonth - 1; i >= 0; i--) {
      const day = previousMonthDays - i;
      days.push(
        <div key={`prev-${day}`} className="flex items-center justify-center aspect-square">
          <span className="text-xs font-bold text-(--theme-text) opacity-30">
            {day}
          </span>
        </div>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isTodayDate = isToday(date);
      const isSelectedDate = isSelected(date);
      const hasEvent = isHighlighted(date);

      days.push(
        <div key={day} className="flex items-center justify-center aspect-square">
          <button
            onClick={() => handleDateClick(day)}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all relative",
              isTodayDate
                ? "bg-(--theme-text) text-(--theme-bg)"  // High contrast for today
                : "text-(--theme-text) hover:bg-(--theme-text)/10",
              isSelectedDate && !isTodayDate && "ring-2 ring-(--theme-text) ring-offset-1 ring-offset-(--theme-sidebar)", // Selection ring
              isSelectedDate && isTodayDate && "ring-2 ring-(--theme-text) ring-offset-1 ring-offset-(--theme-sidebar)",
              hasEvent && !isTodayDate && !isSelectedDate && "font-extrabold" // Indicate event? or maybe a dot?
            )}
          >
            {day}
            {hasEvent && !isTodayDate && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-(--theme-secondary)"></span>
            )}
          </button>
        </div>
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <div key={`next-${day}`} className="flex items-center justify-center aspect-square">
          <span className="text-xs font-bold text-(--theme-text) opacity-30">
            {day}
          </span>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl md:text-2xl font-bold text-(--theme-text) uppercase tracking-tight">
          {monthNames[month]}. {year}.
        </h3>
        <div className="flex gap-1 items-center">
          <FancyButton
            onClick={goToPreviousMonth}
            className="h-7 w-7 p-0 bg-(--theme-bg) text-(--theme-text) shadow-none border-0"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={3} />
          </FancyButton>
          <FancyButton
            onClick={goToToday}
            className="h-7 px-2 bg-(--theme-bg) hover:bg-(--theme-card)/50 text-(--theme-text) shadow-none border-0 text-xs font-bold uppercase tracking-wide"
          >
            Today
          </FancyButton>
          <FancyButton
            onClick={goToNextMonth}
            className="h-7 w-7 p-0 bg-(--theme-bg) text-(--theme-text) shadow-none border-0"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={3} />
          </FancyButton>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="text-center text-[10px] md:text-xs font-bold text-(--theme-text)/60 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {renderCalendarDays()}
      </div>
    </div>
  );
}
