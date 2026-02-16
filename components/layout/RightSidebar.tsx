"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, X } from "lucide-react";
import { CalendarWidget } from "./CalendarWidget";
import { ReminderItem } from "@/components/dashboard/ReminderItem";
import { BeeAvatar } from "@/components/ui/BeeAvatar";
import { useLayout } from "./LayoutProvider";
import { useSettings } from "@/components/settings/SettingsProvider";
import { useDashboard } from "@/lib/DashboardContext";
import { cn } from "@/lib/utils";
import { EventModal } from "@/components/calendar/EventModal";
import { EventDetailModal } from "@/components/calendar/EventDetailModal";
import { useEventSync } from "@/hooks/use-event-sync";

interface RightSidebarProps {
  variant?: "inline" | "overlay";
  onClose?: () => void;
}

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
}

const BANNER_HEIGHT = 80;
const DEFAULT_BANNER_URL = "/images/BannerBackground.png";

export function RightSidebar({ variant = "inline", onClose }: RightSidebarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventData | null>(null);
  const [eventDates, setEventDates] = useState<Date[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { isRightSidebarOpen } = useLayout();
  const { openProfileModal } = useSettings();
  const { data } = useDashboard();
  const isOverlay = variant === "overlay";
  const user = data?.user;
  const userName = user?.name ?? "Guest";
  const userRole = user?.role ?? "Learner";
  const userAvatar = user?.avatar ?? null;
  const bannerImageUrl = user?.bannerImageUrl ?? null;

  // Fetch events for the current month (for calendar highlights)
  const fetchMonthEvents = useCallback(async () => {
    try {
      // Add timestamp to prevent browser caching
      const res = await fetch(`/api/user/events?month=${currentMonth}&ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      if (!res.ok) return;
      const events: EventData[] = await res.json();
      const dates = events.map((e) => new Date(e.startDate));
      setEventDates(dates);
    } catch {
      // ignore
    }
  }, [currentMonth]);

  // Fetch next 2 upcoming events (for reminders)
  const fetchUpcomingEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/events?upcoming=2&ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      if (!res.ok) return;
      const events: EventData[] = await res.json();
      setUpcomingEvents(events);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMonthEvents();
  }, [fetchMonthEvents]);

  useEffect(() => {
    fetchUpcomingEvents();
  }, [fetchUpcomingEvents]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setEventModalOpen(true);
  };

  const handleMonthChange = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    setCurrentMonth(`${y}-${m}`);
  };

  // Sync with other components
  const { triggerUpdate } = useEventSync(() => {
    fetchMonthEvents();
    fetchUpcomingEvents();
  });

  const handleEventsChanged = () => {
    triggerUpdate();
    fetchMonthEvents();
    fetchUpcomingEvents();
  };

  // Format upcoming event date for display: "2026. December 12. Friday"
  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.toLocaleDateString("en-US", { month: "long" });
    const day = d.getDate();
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    return `${year}. ${month} ${day}. ${weekday}`;
  };

  return (
    <>
      <div
        className={cn(
          "bg-(--theme-sidebar) flex flex-col rounded-tl-[30px] rounded-bl-[30px] relative overflow-hidden transition-transform duration-300 ease-in-out w-full",
          isOverlay ? "h-screen" : "h-full w-72",
          !isOverlay && !isRightSidebarOpen && "translate-x-full"
        )}
      >
        {/* Banner */}
        <div
          className="relative rounded-tl-[30px] shrink-0 bg-[#fef9c3]"
          style={{
            minHeight: BANNER_HEIGHT,
            backgroundImage: `url(${bannerImageUrl ?? DEFAULT_BANNER_URL})`,
            backgroundSize: "contain",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute top-0 right-0 flex items-center gap-2 p-2 md:p-1.5">
            {isOverlay && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="p-2 rounded-md hover:bg-black/10 text-(--theme-text)"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={openProfileModal}
              aria-label="Profile settings"
              className="p-2 rounded-md hover:bg-black/10 text-(--theme-text)"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="px-6 pb-4 md:px-4 -mt-10 relative z-10">
          <div className="flex flex-col items-center mb-4 md:mb-3">
            <div className="mb-3 md:mb-2">
              <BeeAvatar avatarUrl={userAvatar} />
            </div>
            <p className="text-[40px] md:text-2xl font-semibold text-(--theme-text) uppercase tracking-wide text-center">
              {userName}
            </p>
            <p className="text-[32px] md:text-xl text-(--theme-text) uppercase tracking-wide">
              {userRole}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 md:px-4 md:pb-4 flex-1 overflow-hidden">
          <div className="mb-6 md:mb-4">
            <CalendarWidget
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              highlightedDates={eventDates}
              onMonthChange={handleMonthChange}
            />
          </div>

          <div>
            <h3 className="text-[32px] md:text-xl font-semibold uppercase tracking-wide text-(--theme-text) mb-2 md:mb-0">
              REMINDERS
            </h3>
            <div>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setDetailEvent(event)}
                    className="w-full text-left cursor-pointer hover:bg-(--theme-card)/30 rounded-xl transition-colors px-1.5 py-0.5"
                  >
                    <ReminderItem
                      task={event.title}
                      date={formatEventDate(event.startDate)}
                      time={event.isAllDay ? "All day" : event.startTime ?? ""}
                    />
                  </button>
                ))
              ) : (
                <p className="text-sm text-(--theme-text) py-2">No upcoming events</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <EventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        selectedDate={selectedDate}
        onEventsChanged={handleEventsChanged}
      />

      {detailEvent && (
        <EventDetailModal
          open={!!detailEvent}
          onClose={() => setDetailEvent(null)}
          event={detailEvent}
          onEventUpdated={handleEventsChanged}
        />
      )}
    </>
  );
}
