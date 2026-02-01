"use client";

import { useFocus } from "@/components/focus/FocusProvider";

export function Header() {
  const { isSessionActive, timeRemaining, currentMode } = useFocus();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
