"use client";

import { useText } from "@/i18n/use-text";

import { useRef, useEffect } from "react";
import Draggable, { type DraggableData, type DraggableEvent } from "react-draggable";
import { useFocus } from "./FocusProvider";
import {
  ChevronUp,
  Minus,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TimerWidget() {
  const t = useText();
  const {
    isSessionActive,
    currentMode,
    timeRemaining,
    isRunning,
    isMinimized,
    pauseTimer,
    resumeTimer,
    restart,
    next,
    stopSession,
    toggleMinimize,
    widgetPosition,
    setWidgetPosition,
  } = useFocus();

  const nodeRef = useRef<HTMLDivElement>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Update position when dragging stops
  const handleDragStop = (_event: DraggableEvent, data: DraggableData) => {
    setWidgetPosition({ x: data.x, y: data.y });
  };

  // Ensure widget position is set correctly on mount
  useEffect(() => {
    if (isSessionActive && typeof window !== "undefined") {
      if (widgetPosition.y === 600) {
        // Only update if it's still at default position
        setWidgetPosition({ x: 20, y: window.innerHeight - 200 });
      }
    }
  }, [isSessionActive, setWidgetPosition, widgetPosition.y]);

  if (!isSessionActive) {
    return null;
  }

  if (isMinimized) {
    return (
      <Draggable
        nodeRef={nodeRef}
        position={widgetPosition}
        onStop={handleDragStop}
        handle=".drag-handle"
      >
        <div
          ref={nodeRef}
          className="fixed z-9999 flex min-w-[174px] items-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] font-[var(--font-geist-sans)] text-[var(--app-text)] shadow-[var(--app-shadow-elevated)]"
        >
          <div className="drag-handle flex min-w-0 flex-1 cursor-grab items-center px-3 py-2.5 active:cursor-grabbing">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-xs font-semibold text-[var(--app-text-muted)]">
                {currentMode === "active" ? t("Focus") : t("Break")}
              </span>
              <span className="text-sm font-semibold tabular-nums tracking-tight">
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMinimize}
            aria-label={t("Restore focus timer")}
            className="mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </Draggable>
    );
  }

  return (
    <Draggable
      nodeRef={nodeRef}
      position={widgetPosition}
      onStop={handleDragStop}
      handle=".drag-handle"
    >
      <div
        ref={nodeRef}
        role="region"
        aria-labelledby="focus-timer-title"
        className="fixed z-9999 w-[252px] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] font-[var(--font-geist-sans)] text-[var(--app-text)] shadow-[var(--app-shadow-elevated)]"
      >
        <div className="flex min-h-14 items-center border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]/70">
          <div className="drag-handle flex min-w-0 flex-1 cursor-grab items-center px-4 py-3 active:cursor-grabbing">
            <h2 id="focus-timer-title" className="min-w-0 text-sm font-semibold tracking-tight">
              <span>{currentMode === "active" ? t("Focus") : t("Break")}</span>
              <span aria-hidden="true" className="px-1.5 text-[var(--app-text-faint)]">·</span>
              <span className="tabular-nums">{formatTime(timeRemaining)}</span>
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 pr-2">
            <button
              type="button"
              onClick={toggleMinimize}
              aria-label={t("Minimize focus timer")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={stopSession}
              aria-label={t("Stop focus session")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={restart} aria-label={t("Restart focus timer")} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("Restart")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={isRunning ? pauseTimer : resumeTimer} aria-label={isRunning ? t("Pause focus timer") : t("Resume focus timer")} className="inline-flex h-10 w-16 items-center justify-center rounded-xl border border-[var(--app-accent-hover)] bg-[var(--app-accent-soft)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
                {isRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isRunning ? t("Pause") : t("Play")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={next} aria-label={t("Skip to next focus timer interval")} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
                <SkipForward className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("Next")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Draggable>
  );
}
