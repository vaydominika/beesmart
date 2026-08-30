"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import { CalendarWidget } from "./CalendarWidget";
import { ReminderItem } from "@/components/dashboard/ReminderItem";
import { useLayout } from "./LayoutProvider";
import { useSettings } from "@/components/settings/SettingsProvider";
import { useDashboard } from "@/lib/DashboardContext";
import { cn } from "@/lib/utils";
import { EventModal } from "@/components/calendar/EventModal";
import { EventDetailModal } from "@/components/calendar/EventDetailModal";
import { isClassroomWorkEvent } from "@/components/calendar/ClassroomWorkEditModal";
import { useEventSync } from "@/hooks/use-event-sync";
import { NotificationCenter } from "./NotificationCenter";
import type { ScheduleEvent } from "@/lib/schedule";

interface RightSidebarProps {
  variant?: "inline" | "overlay";
  onClose?: () => void;
}

type EventData = ScheduleEvent;

const BANNER_HEIGHT = 80;
const DEFAULT_BANNER_URL = "/images/default_banner.jpg";

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
  const userAvatar = user?.avatar ?? null;
  const bannerImageUrl = user?.bannerImageUrl ?? null;
  const activeTicketCount = data?.activeTicketCount ?? 0;

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

  const fetchUpcomingEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/events?upcoming=3&ts=${Date.now()}`, {
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

  const reconcileDetailEvent = useCallback(async () => {
    if (!detailEvent) return;
    try {
      const response = await fetch(`/api/user/events?id=${encodeURIComponent(detailEvent.id)}&ts=${Date.now()}`, {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      if (response.ok) {
        setDetailEvent(await response.json());
      } else if (response.status === 404) {
        setDetailEvent(null);
      }
    } catch {
      // Keep the existing detail open during a transient network failure.
    }
  }, [detailEvent]);

  useEffect(() => {
    const timeout = window.setTimeout(fetchMonthEvents, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchMonthEvents]);

  useEffect(() => {
    const timeout = window.setTimeout(fetchUpcomingEvents, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchUpcomingEvents]);

  useEffect(() => {
    const openEvent = async (eventId: string) => {
      const response = await fetch(`/api/user/events?id=${encodeURIComponent(eventId)}`, { cache: "no-store" });
      if (response.ok) setDetailEvent(await response.json());
    };
    const initialId = new URLSearchParams(window.location.search).get("event");
    const timeout = initialId ? window.setTimeout(() => void openEvent(initialId), 0) : null;
    const handleOpenEvent = (event: Event) => void openEvent((event as CustomEvent<string>).detail);
    window.addEventListener("beesmart:open-event", handleOpenEvent);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener("beesmart:open-event", handleOpenEvent);
    };
  }, []);

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
    void fetchMonthEvents();
    void fetchUpcomingEvents();
    void reconcileDetailEvent();
  });

  const handleEventsChanged = () => {
    triggerUpdate();
    void fetchMonthEvents();
    void fetchUpcomingEvents();
    void reconcileDetailEvent();
  };

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
          "bg-(--theme-sidebar) flex flex-col rounded-tl-[30px] relative overflow-hidden transition-transform duration-300 ease-in-out w-full",
          isOverlay ? "h-screen" : "h-full w-72",
          !isOverlay && !isRightSidebarOpen && "translate-x-full"
        )}
      >
        {/* Banner */}
        <div
          className="relative rounded-tl-[30px] shrink-0 bg-[var(--app-accent-soft)]"
          style={{
            minHeight: BANNER_HEIGHT,
            backgroundImage: `url(${bannerImageUrl ?? DEFAULT_BANNER_URL})`,
            backgroundSize: "cover",
            backgroundPosition: bannerImageUrl ? "center" : "top center",
          }}
        >
          <div className="absolute top-0 right-0 flex items-center gap-1.5 p-2 md:p-1.5">
            <NotificationCenter />
            {isOverlay && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-subtle)] transition-colors hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Profile */}
        <div className="px-6 pb-4 md:px-4 -mt-10 relative z-10">
          <div className="flex flex-col items-center mb-4 md:mb-3">
            <div className="relative mb-3 md:mb-2">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-(--theme-sidebar) bg-[var(--app-surface)]">
                <Image
                  src={userAvatar?.trim() || "/images/default_pfp.jpg"}
                  alt={userName || "Profile"}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover object-center"
                  unoptimized={userAvatar?.trim().startsWith("/api/files/") ?? false}
                />
              </div>
              <button
                type="button"
                onClick={openProfileModal}
                aria-label="Profile settings"
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-(--theme-sidebar) bg-[var(--app-surface)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              >
                <Settings className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[40px] md:text-2xl font-semibold text-(--theme-text) uppercase tracking-wide text-center">
              {userName}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 md:px-4 md:pb-4 flex-1 overflow-hidden">
          {activeTicketCount > 0 ? (
            <Link
              href="/tickets"
              aria-label={`Active tickets: ${activeTicketCount}`}
              className="mb-3 flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-[var(--font-geist-sans)] text-xs font-semibold text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <span>Active tickets</span>
              <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-0.5 text-[var(--app-text)]">{activeTicketCount}</span>
            </Link>
          ) : null}
          <div className="mb-6 md:mb-4">
            <CalendarWidget
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              highlightedDates={eventDates}
              onMonthChange={handleMonthChange}
            />
          </div>

          <div>
            <h3 className="mb-2 text-[32px] font-semibold uppercase tracking-wide text-(--theme-text) md:mb-0 md:text-xl">REMINDERS</h3>
            <div>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => {
                  const classroomWork = isClassroomWorkEvent(event);
                  const dueDate = classroomWork && event.testId && event.endDate ? event.endDate : event.startDate;
                  const dueTime = classroomWork
                    ? event.isAllDay
                      ? ""
                      : event.testId
                        ? event.endTime || ""
                        : event.startTime || ""
                    : event.isAllDay
                      ? "All day"
                      : `${event.startTime || ""}${event.endTime ? ` - ${event.endTime}` : ""}`;
                  return (
                    <button
                      key={event.id}
                      onClick={() => setDetailEvent(event)}
                      className="w-full cursor-pointer rounded-xl px-1.5 py-0.5 text-left transition-colors hover:bg-(--theme-card)/30"
                    >
                      <ReminderItem task={event.title} date={formatEventDate(dueDate)} time={dueTime} />
                    </button>
                  );
                })
              ) : (
                <p className="py-2 text-sm text-(--theme-text)/65">No upcoming events</p>
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

      {detailEvent && <EventDetailModal key={detailEvent.id} open onClose={() => setDetailEvent(null)} event={detailEvent} onEventUpdated={handleEventsChanged} />}
    </>
  );
}
