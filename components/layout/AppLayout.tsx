"use client";

import { Header } from "./Header";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { TimerWidget } from "@/components/focus/TimerWidget";
import { SettingsModal } from "@/components/settings/Settings";
import { useLayout } from "./LayoutProvider";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isRightSidebarOpen, toggleRightSidebar } = useLayout();

  return (
    <div className="flex h-screen bg-(--theme-bg) relative overflow-x-hidden">
      <LeftSidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto bg-(--theme-bg)">{children}</main>
      </div>
      <div className={cn("relative transition-all duration-300 overflow-visible shrink-0 h-screen", isRightSidebarOpen ? "w-[400px]" : "w-0")}>
        <RightSidebar />
      </div>
      <button
        onClick={toggleRightSidebar}
        className={cn(
          "fixed bottom-12 w-12 h-12 bg-(--theme-sidebar) rounded-lg flex items-center justify-center hover:bg-(--theme-sidebar)/90 transition-all duration-300 z-20",
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
      <TimerWidget />
      <SettingsModal />
    </div>
  );
}
