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
  const isCourseWorkspace = pathname === "/courses" || /^\/courses\/[^/]+\/builder$/.test(pathname);
  const quietHeaderClass = isClassroom
    ? "classroom-ui classroom-surface border-(--classroom-line)"
    : isCourseWorkspace
      ? "course-ui course-surface border-(--course-line)"
      : "bg-(--theme-card) border-(--theme-text)/10";
  const quietHoverClass = isClassroom
    ? "hover:bg-(--classroom-surface-muted)"
    : isCourseWorkspace
      ? "hover:bg-(--course-surface-muted)"
      : "hover:bg-(--theme-card)/80";
  const { isLeftSidebarOpen, toggleLeftSidebar, isRightSidebarOpen, toggleRightSidebar } = useLayout();
  const { isSessionActive, timeRemaining, currentMode } = useFocus();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (isMobile) {
    return (
      <header className={cn(
        "h-16 shrink-0 border-b border-[var(--app-border)] bg-(--theme-sidebar) px-3",
      )}>
        <nav aria-label="Mobile application navigation" className="grid h-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
          <button
            type="button"
            onClick={toggleLeftSidebar}
            aria-label="Open menu"
            aria-expanded={isLeftSidebarOpen}
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]", quietHoverClass)}
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          {isSessionActive ? (
            <div className="flex min-w-0 items-center justify-center gap-2">
              <span className="text-sm font-bold uppercase text-[var(--app-text)]">
                {currentMode === "active" ? "FOCUS" : "BREAK"}
              </span>
              <span className="text-lg font-bold tabular-nums text-[var(--app-text)]">
                {formatTime(timeRemaining)}
              </span>
            </div>
          ) : (
            <span className="justify-self-center font-[var(--font-barlow-condensed)] text-base uppercase leading-none tracking-[0.04em] text-[var(--app-text)]">
              BeeSmart
            </span>
          )}
          <button
            type="button"
            onClick={toggleRightSidebar}
            aria-label="Open calendar and profile"
            aria-expanded={isRightSidebarOpen}
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]", quietHoverClass)}
          >
            <PanelRight className="h-5 w-5" />
          </button>
        </nav>
      </header>
    );
  }

  if (!isSessionActive) {
    return null;
  }

  return (
    <div className={cn("px-6 py-4 border-b", quietHeaderClass)}>
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
