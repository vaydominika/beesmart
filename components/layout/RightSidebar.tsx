"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { CalendarWidget } from "./CalendarWidget";
import { ReminderItem } from "@/components/dashboard/ReminderItem";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { mockReminders } from "@/lib/mockData";
import { useLayout } from "./LayoutProvider";
import { useSettings } from "@/components/settings/SettingsProvider";
import { SettingsModal } from "@/components/settings/Settings";
import { cn } from "@/lib/utils";

export function RightSidebar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { isRightSidebarOpen } = useLayout();
  const { openModal: openSettingsModal, userName, userRole } = useSettings();

  const highlightedDates = [
    new Date(2022, 11, 2),
    new Date(2022, 11, 19),
    new Date(2022, 11, 29),
  ];

  return (
    <div className={cn(
      "w-[400px] bg-(--theme-sidebar) flex flex-col h-screen rounded-tl-[30px] rounded-bl-[30px] relative overflow-visible transition-transform duration-300 ease-in-out",
      !isRightSidebarOpen && "translate-x-full"
    )}>
      <div className="p-4 flex justify-end">
        <button 
          onClick={openSettingsModal}
          className="p-2 hover:bg-(--theme-sidebar)/80 transition-colors"
        >
          <Settings className="h-5 w-5 text-(--theme-text)" />
        </button>
      </div>
      <div className="px-6 pb-6">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3">
            <BeeAvatar />
          </div>
          <p className="text-[40px] font-semibold text-(--theme-text)">{userName}</p>
          <p className="text-[32px] text-(--theme-text)">{userRole}</p>
        </div>

        <div className="mb-6">
          <CalendarWidget
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            highlightedDates={highlightedDates}
          />
        </div>

        <div>
          <h3 className="text-[32px] font-semibold uppercase tracking-wide text-(--theme-text) mb-3">
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
