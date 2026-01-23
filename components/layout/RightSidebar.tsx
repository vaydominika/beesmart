"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { CalendarWidget } from "./CalendarWidget";
import { ReminderItem } from "@/components/dashboard/ReminderItem";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { mockUser, mockReminders } from "@/lib/mockData";

export function RightSidebar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const highlightedDates = [
    new Date(2022, 11, 2),
    new Date(2022, 11, 19),
    new Date(2022, 11, 29),
  ];

  return (
    <div className="w-[400px] bg-[var(--theme-sidebar)] flex flex-col min-h-screen">
      <div className="p-4 flex justify-end">
        <button className="p-2 hover:bg-[var(--theme-sidebar)]/80 rounded-md transition-colors">
          <Settings className="h-5 w-5 text-[var(--theme-text)]" />
        </button>
      </div>
      <div className="px-6 pb-6">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3">
            <BeeAvatar />
          </div>
          <p className="text-[40px] font-semibold text-[var(--theme-text)]">{mockUser.name}</p>
          <p className="text-[32px] text-[var(--theme-text)]">{mockUser.role}</p>
        </div>

        <div className="mb-6">
          <CalendarWidget
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            highlightedDates={highlightedDates}
          />
        </div>

        <div>
          <h3 className="text-[32px] font-semibold uppercase tracking-wide text-[var(--theme-text)] mb-3">
            REMINDERS
          </h3>
          <div className="space-y-1">
            {mockReminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                task={reminder.task}
                date={reminder.date}
                time={reminder.time}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
