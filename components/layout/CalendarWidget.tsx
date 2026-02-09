"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarWidgetProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  highlightedDates?: Date[];
}

export function CalendarWidget({
  selectedDate,
  onDateSelect,
  highlightedDates = [],
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
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
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
        date.getDate() === highlighted.getDate() &&
        date.getMonth() === highlighted.getMonth() &&
        date.getFullYear() === highlighted.getFullYear()
    );
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    onDateSelect?.(date);
  };

  const renderCalendarDays = () => {
    const days = [];
    const previousMonthDays = new Date(year, month, 0).getDate();
    const daysToShowFromPreviousMonth = adjustedStartingDay;

      for (let i = daysToShowFromPreviousMonth - 1; i >= 0; i--) {
      const day = previousMonthDays - i;
      const date = new Date(year, month - 1, day);
      days.push(
        <button
          key={`prev-${day}`}
          className="text-(--theme-text) text-base md:text-sm py-3 md:py-2 opacity-50"
          disabled
        >
          {day}
        </button>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isTodayDate = isToday(date);
      const isSelectedDate = isSelected(date);
      const isHighlightedDate = isHighlighted(date) && !isTodayDate && !isSelectedDate;

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(day)}
          className={cn(
            "text-base md:text-sm py-3 md:py-2 rounded-full transition-colors",
            isSelectedDate || isTodayDate
              ? "bg-(--theme-card) text-(--theme-text)"
              : isHighlightedDate
              ? "bg-(--theme-card) text-(--theme-text)"
              : "text-(--theme-text) hover:bg-(--theme-sidebar)/50"
          )}
        >
          {day}
        </button>
      );
    }

    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <button
          key={`next-${day}`}
          className="text-(--theme-text) text-base md:text-sm py-3 md:py-2 opacity-50"
          disabled
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5 md:mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          className="h-10 w-10 md:h-8 md:w-8 bg-(--theme-bg) hover:bg-(--theme-sidebar)/90"
        >
          <ChevronLeft className="h-5 w-5 md:h-4 md:w-4 text-(--theme-text)" />
        </Button>
        <h3 className="text-lg md:text-base font-medium text-(--theme-text)">
          {monthNames[month]}. {year}.
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="h-10 w-10 md:h-8 md:w-8 bg-(--theme-bg) hover:bg-(--theme-sidebar)/90"
        >
          <ChevronRight className="h-5 w-5 md:h-4 md:w-4 text-(--theme-text)" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0 mb-3 md:mb-2">
        {daysOfWeek.map((day) => (
          <div key={day} className="text-center text-base md:text-sm font-medium text-(--theme-text) py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0">{renderCalendarDays()}</div>
    </div>
  );
}
