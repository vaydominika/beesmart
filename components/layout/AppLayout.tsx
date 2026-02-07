"use client";

import { useRef, useState, useEffect } from "react";
import { Header } from "./Header";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TimerWidget } from "@/components/focus/TimerWidget";
import { SettingsModal } from "@/components/settings/Settings";
import { useLayout } from "./LayoutProvider";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FancyButton } from "@/components/ui/fancybutton";

const SCROLL_THRESHOLD = 200;

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isRightSidebarOpen, toggleRightSidebar } = useLayout();
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

  return (
    <div className="flex h-screen bg-(--theme-bg) relative overflow-x-hidden">
      <LeftSidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-(--theme-bg)">{children}</main>
      </div>
      <div className={cn("relative transition-all duration-300 overflow-visible shrink-0 h-screen", isRightSidebarOpen ? "w-[400px]" : "w-0")}>
        <RightSidebar />
      </div>
      <button
        onClick={toggleRightSidebar}
        className={cn(
          "fixed bottom-36 w-8 h-10 bg-(--theme-sidebar) rounded-tl-[15px] rounded-bl-[15px] flex items-center justify-center hover:bg-(--theme-sidebar)/90 transition-all duration-300 z-20",
          isRightSidebarOpen ? "right-[388px]" : "right-0"
        )}
        aria-label={isRightSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isRightSidebarOpen ? (
          <ChevronRight className="h-6 w-6 text-(--theme-text)" />
        ) : (
          <ChevronLeft className="h-6 w-6 text-(--theme-text)" />
        )}
      </button>
      <FancyButton
        onClick={scrollToTop}
        aria-label="Back to top"
        className={cn(
          "fixed bottom-4 right-4 rounded-full p-0 bg-(--theme-sidebar) flex items-center justify-center transition-all duration-300 z-20",
          showBackToTop
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-0 pointer-events-none"
        )}
      >
        <ChevronUp className="h-10 w-10 text-(--theme-text)" />
      </FancyButton>
      <TimerWidget />
      <SettingsModal />
    </div>
  );
}
