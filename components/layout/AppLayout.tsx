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
import { FancyButton } from "@/components/ui/fancybutton";
import { Toaster } from "@/components/ui/sonner";

const SCROLL_THRESHOLD = 200;
const LAPTOP_SIDEBAR_WIDTH = 288; // w-72

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { isLeftSidebarOpen, toggleLeftSidebar, isRightSidebarOpen, toggleRightSidebar } = useLayout();
  const mainRef = useRef<HTMLElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const scrollEl =
      main.querySelector<HTMLElement>("[data-slot=\"scroll-area-viewport\"]") ?? main;

    const handleScroll = () => {
      setShowBackToTop(scrollEl.scrollTop > SCROLL_THRESHOLD);
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const main = mainRef.current;
    if (!main) return;
    const scrollEl =
      main.querySelector<HTMLElement>("[data-slot=\"scroll-area-viewport\"]") ?? main;
    scrollEl.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isMobile) {
    return (
      <div className="flex h-screen bg-(--theme-bg) relative overflow-x-hidden">
        <div className="flex flex-col flex-1 overflow-hidden min-w-0 w-full">
          <Header />
          <main ref={mainRef} className="flex-1 overflow-y-auto bg-(--theme-bg)">{children}</main>
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

        <FancyButton
          onClick={scrollToTop}
          aria-label="Back to top"
          className={cn(
            "fixed bottom-4 right-4 p-0 w-14 h-14 rounded-full bg-(--theme-sidebar) flex items-center justify-center transition-all duration-300 z-999 shadow-sm",
            showBackToTop
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-0 pointer-events-none"
          )}
        >
          <ChevronUp className="h-10 w-10 text-(--theme-text)" />
        </FancyButton>
        <TimerWidget />
        <SettingsModal />
        <ProfileSettingsModal />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-(--theme-bg) relative overflow-x-hidden">
      <div className="hidden md:block shrink-0 h-screen">
        <LeftSidebar variant="inline" />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-(--theme-bg)">{children}</main>
      </div>
      <div
        className={cn(
          "relative transition-all duration-300 overflow-visible shrink-0 h-screen hidden md:block",
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
        <FancyButton
          onClick={scrollToTop}
          aria-label="Back to top"
          className={cn(
            "fixed bottom-4 right-4 p-0 w-10 h-10 rounded-full bg-(--theme-sidebar) flex items-center justify-center transition-all duration-300 z-999 shadow-lg",
            showBackToTop
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-0 pointer-events-none"
          )}
        >
          <ChevronUp className="h-6 w-6 text-(--theme-text)" />
        </FancyButton>
      <TimerWidget />
      <SettingsModal />
      <ProfileSettingsModal />
      <Toaster />
    </div>
  );
}
