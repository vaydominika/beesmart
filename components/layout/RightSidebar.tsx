"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { CalendarWidget } from "./CalendarWidget";
import { ReminderItem } from "@/components/dashboard/ReminderItem";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { mockReminders } from "@/lib/mockData";
import { useLayout } from "./LayoutProvider";
import { useSettings } from "@/components/settings/SettingsProvider";
import { cn } from "@/lib/utils";

interface RightSidebarProps {
  variant?: "inline" | "overlay";
  onClose?: () => void;
}

export function RightSidebar({ variant = "inline", onClose }: RightSidebarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { isRightSidebarOpen } = useLayout();
  const { openModal: openSettingsModal, userName, userRole } = useSettings();
  const isOverlay = variant === "overlay";

  const highlightedDates = [
    new Date(2022, 11, 2),
    new Date(2022, 11, 19),
    new Date(2022, 11, 29),
  ];

  return (
    <div
      className={cn(
        "bg-(--theme-sidebar) flex flex-col rounded-tl-[30px] rounded-bl-[30px] relative overflow-visible transition-transform duration-300 ease-in-out w-full",
        isOverlay ? "h-screen" : "h-full w-72",
        !isOverlay && !isRightSidebarOpen && "translate-x-full"
      )}
    >
      <div className="p-4 md:p-3 flex justify-end items-center gap-2">
        {isOverlay && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-2 rounded-md hover:bg-(--theme-sidebar)/80 text-(--theme-text)"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <button 
          onClick={openSettingsModal}
          className="p-2 hover:bg-(--theme-sidebar)/80 transition-colors"
        >
          <Settings className="h-5 w-5 text-(--theme-text)" />
        </button>
      </div>
      <div className="px-6 pb-6 md:px-4 md:pb-4">
        <div className="flex flex-col items-center mb-6 md:mb-4">
          <div className="mb-3 md:mb-2">
            <BeeAvatar />
          </div>
          <p className="text-[40px] md:text-2xl font-semibold text-(--theme-text)">{userName}</p>
          <p className="text-[32px] md:text-xl text-(--theme-text)">{userRole}</p>
        </div>

        <div className="mb-6 md:mb-4">
          <CalendarWidget
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            highlightedDates={highlightedDates}
          />
        </div>

        <div>
          <h3 className="text-[32px] md:text-xl font-semibold uppercase tracking-wide text-(--theme-text) mb-3 md:mb-2">
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
