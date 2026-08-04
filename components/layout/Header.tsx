"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { useFocus } from "@/components/focus/FocusProvider";
import { useLayout } from "./LayoutProvider";
import { useIsMobile } from "./useIsMobile";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Header() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isClassroom = pathname.startsWith("/classroom");
  const { toggleLeftSidebar, toggleRightSidebar } = useLayout();
  const { isSessionActive, timeRemaining, currentMode } = useFocus();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isMobile) {
    return (
      <div className={cn(
        "px-4 py-3 border-b shrink-0",
        isClassroom ? "classroom-ui classroom-surface border-(--classroom-line)" : "bg-(--theme-card) border-(--theme-text)/10",
      )}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleLeftSidebar}
            aria-label="Open menu"
            className={cn("p-2 rounded-md text-(--theme-text)", isClassroom ? "hover:bg-(--classroom-surface-muted)" : "hover:bg-(--theme-card)/80")}
          >
            <PanelLeft className="h-6 w-6" />
          </button>
          {isSessionActive ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-(--theme-text) uppercase">
                {currentMode === "active" ? "FOCUS" : "BREAK"}
              </span>
              <span className="text-lg font-bold text-(--theme-text)">
                {formatTime(timeRemaining)}
              </span>
            </div>
          ) : (
            <span className="text-(--theme-text) font-semibold" aria-hidden="true">
              BeeSmart
            </span>
          )}
          <button
            type="button"
            onClick={toggleRightSidebar}
            aria-label="Open calendar and profile"
            className={cn("p-2 rounded-md text-(--theme-text)", isClassroom ? "hover:bg-(--classroom-surface-muted)" : "hover:bg-(--theme-card)/80")}
          >
            <PanelRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  if (!isSessionActive) {
    return null;
  }

  return (
    <div className={cn("px-6 py-4 border-b", isClassroom ? "classroom-ui classroom-surface border-(--classroom-line)" : "bg-(--theme-card) border-(--theme-text)/10")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[24px] font-bold text-(--theme-text) uppercase">
            {currentMode === "active" ? "FOCUS" : "BREAK"}
          </div>
          <div className="text-[32px] font-bold text-(--theme-text)">
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>
    </div>
  );
}
