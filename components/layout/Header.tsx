"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { useFocus } from "@/components/focus/FocusProvider";
import { useLayout } from "./LayoutProvider";
import { useIsMobile } from "./useIsMobile";

export function Header() {
  const isMobile = useIsMobile();
  const { toggleLeftSidebar, toggleRightSidebar } = useLayout();
  const { isSessionActive, timeRemaining, currentMode } = useFocus();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isMobile) {
    return (
      <div className="bg-(--theme-card) px-4 py-3 border-b border-(--theme-text)/10 shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleLeftSidebar}
            aria-label="Open menu"
            className="p-2 rounded-md hover:bg-(--theme-card)/80 text-(--theme-text)"
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
            className="p-2 rounded-md hover:bg-(--theme-card)/80 text-(--theme-text)"
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
    <div className="bg-(--theme-card) px-6 py-4 border-b border-(--theme-text)/10">
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
