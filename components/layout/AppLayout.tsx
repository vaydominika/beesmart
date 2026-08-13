"use client";

import { useRef, useState, useEffect } from "react";
import { Header } from "./Header";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TimerWidget } from "@/components/focus/TimerWidget";
import { SettingsModal } from "@/components/settings/Settings";
import { ProfileSettingsModal } from "@/components/settings/ProfileSettingsModal";
import { useLayout } from "./LayoutProvider";
import { useIsMobile } from "./useIsMobile";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePathname } from "next/navigation";

const SCROLL_THRESHOLD = 200;
const LAPTOP_SIDEBAR_WIDTH = 288; // w-72

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isClassroom = pathname.startsWith("/classroom");
  const isDashboard = pathname === "/dashboard";
  const isSchedule = pathname.startsWith("/schedule");
  const isCoursesIndex = pathname === "/courses";
  const isCourseBuilder = /^\/courses\/[^/]+\/builder$/.test(pathname);
  const isProfile = /^\/profile\/[^/]+$/.test(pathname);
  const isFocusedWorkspace = isSchedule || isCoursesIndex || isCourseBuilder || isProfile;
  const isQuietWorkspace = isDashboard || isClassroom || isFocusedWorkspace;
  const { isLeftSidebarOpen, toggleLeftSidebar, isRightSidebarOpen, toggleRightSidebar } = useLayout();
  const mainRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const scrollEl = isProfile && !isMobile
      ? main
      : main.querySelector<HTMLElement>("[data-slot=\"scroll-area-viewport\"]") ?? main;

    const handleScroll = () => {
      setShowBackToTop(scrollEl.scrollTop > SCROLL_THRESHOLD);
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isMobile, isProfile]);

  const scrollToTop = () => {
    const main = mainRef.current;
    if (!main) return;
    const scrollEl = isProfile && !isMobile
      ? main
      : main.querySelector<HTMLElement>("[data-slot=\"scroll-area-viewport\"]") ?? main;
    scrollEl.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isMobile) {
    return (
      <div className={cn("relative flex h-screen overflow-x-hidden", isQuietWorkspace ? "bg-(--app-canvas)" : "bg-(--theme-bg)")}>
        <div className="flex flex-col flex-1 overflow-hidden min-w-0 w-full">
          <Header />
          <main ref={mainRef} className={cn("flex-1 overflow-hidden", isQuietWorkspace ? "bg-(--app-canvas)" : "bg-(--theme-bg)")}>
            <ScrollArea className="h-full">
              {children}
            </ScrollArea>
          </main>
        </div>

        {/* Backdrop when either sidebar is open */}
        {(isLeftSidebarOpen || isRightSidebarOpen) && (
          <button
            type="button"
            aria-label="Close overlays"
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => {
              if (isLeftSidebarOpen) toggleLeftSidebar();
              if (isRightSidebarOpen) toggleRightSidebar();
            }}
          />
        )}

        {/* Left sidebar overlay */}
        <div
          className={cn(
            "fixed top-0 left-0 h-screen z-40 transition-transform duration-300 ease-in-out md:hidden",
            isLeftSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ width: "min(85vw, 320px)" }}
        >
          <LeftSidebar onClose={toggleLeftSidebar} variant="overlay" />
        </div>

        {/* Right sidebar overlay */}
        <div
          className={cn(
            "fixed top-0 right-0 h-screen z-40 transition-transform duration-300 ease-in-out md:hidden",
            isRightSidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
          style={{ width: "min(85vw, 320px)" }}
        >
          <RightSidebar onClose={toggleRightSidebar} variant="overlay" />
        </div>

        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className={cn(
            "fixed bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] transition-all duration-300 z-999 shadow-sm hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
            showBackToTop
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-0 pointer-events-none"
          )}
        >
          <ChevronUp className="h-10 w-10 text-(--theme-text)" />
        </button>
        <TimerWidget />
        <SettingsModal />
        <ProfileSettingsModal />
        <Toaster />
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-screen overflow-x-hidden", isQuietWorkspace ? "bg-(--app-canvas)" : "bg-(--theme-bg)")}>
      {!isCourseBuilder && (
        <div className="hidden md:block shrink-0 h-screen">
          <LeftSidebar variant="inline" />
        </div>
      )}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main ref={mainRef} className={cn("flex-1 overflow-hidden", isQuietWorkspace ? "bg-(--app-canvas)" : "bg-(--theme-bg)")}>
          {isProfile ? children : (
            <ScrollArea className="h-full">
              {children}
            </ScrollArea>
          )}
        </main>
      </div>
      {!isFocusedWorkspace && (
        <>
          <div
            className={cn(
              "relative transition-all duration-300 overflow-hidden shrink-0 h-screen hidden md:block",
              isRightSidebarOpen ? "w-72" : "w-0"
            )}
          >
            <RightSidebar variant="inline" />
          </div>
          <button
            onClick={toggleRightSidebar}
            className="fixed bottom-36 w-8 h-10 md:w-5 md:h-9 md:bottom-24 bg-(--theme-sidebar) rounded-tl-[15px] rounded-bl-[15px] md:rounded-tl-[10px] md:rounded-bl-[10px] hidden md:flex items-center justify-center hover:bg-(--theme-sidebar)/90 transition-all duration-300 z-20"
            style={{ right: isRightSidebarOpen ? LAPTOP_SIDEBAR_WIDTH : 0 }}
            aria-label={isRightSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isRightSidebarOpen ? (
              <ChevronRight className="h-6 w-6 text-(--theme-text) md:h-5 md:w-5 md:translate-x-0.5" />
            ) : (
              <ChevronLeft className="h-6 w-6 text-(--theme-text) md:h-5 md:w-5" />
            )}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        className={cn(
          "fixed bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] transition-all duration-300 z-999 shadow-sm hover:bg-[var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]",
          showBackToTop
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-0 pointer-events-none"
        )}
      >
        <ChevronUp className="h-6 w-6 text-(--theme-text)" />
      </button>
      <TimerWidget />
      <SettingsModal />
      <ProfileSettingsModal />
      <Toaster />
    </div>
  );
}
