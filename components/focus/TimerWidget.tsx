"use client";

import { useRef, useEffect } from "react";
import Draggable from "react-draggable";
import { useFocus } from "./FocusProvider";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UndoIcon,
  PauseIcon,
  PlayIcon,
  NextIcon,
  Minimize01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

export function TimerWidget() {
  const {
    isSessionActive,
    timeRemaining,
    isRunning,
    isMinimized,
    currentMode,
    pauseTimer,
    resumeTimer,
    undo,
    next,
    stopSession,
    toggleMinimize,
    widgetPosition,
    setWidgetPosition,
  } = useFocus();

  const nodeRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Update position when dragging stops
  const handleDragStop = (e: any, data: any) => {
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
  }, [isSessionActive]);

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
          className="fixed z-[9999] bg-[#FFF6C4] rounded-[15px] p-2 shadow-lg cursor-move"
        >
          <div className="flex items-center gap-1.5">
            <div className="drag-handle cursor-move">
              <div className="w-1.5 h-1.5 bg-[var(--theme-text)] rounded-full"></div>
            </div>
            <button
              onClick={toggleMinimize}
              className="text-[var(--theme-text)] hover:text-[var(--theme-secondary)]"
            >
              <HugeiconsIcon icon={Minimize01Icon} className="rotate-180" size={14} />
            </button>
          </div>
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
        className="fixed z-[9999] bg-[#FFF6C4] rounded-[15px] p-3 shadow-lg min-w-[160px]"
      >
        {/* Window controls */}
        <div className="flex items-center justify-end gap-1.5 mb-1.5">
          <button
            onClick={toggleMinimize}
            className="text-[var(--theme-text)] hover:text-[var(--theme-secondary)] transition-colors"
          >
            <HugeiconsIcon icon={Minimize01Icon} size={16} />
          </button>
          <button
            onClick={stopSession}
            className="text-[var(--theme-text)] hover:text-[var(--theme-secondary)] transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        {/* Timer display */}
        <div className="text-center mb-2">
          <div className="text-[32px] font-bold text-[var(--theme-text)] drag-handle cursor-move">
            {formatTime(timeRemaining)}
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-2.5">
          <button
            onClick={undo}
            className="p-1.5 text-[var(--theme-text)] hover:text-[var(--theme-secondary)] transition-colors"
            title="Undo"
          >
            <HugeiconsIcon icon={UndoIcon} size={20} />
          </button>
          <button
            onClick={isRunning ? pauseTimer : resumeTimer}
            className="p-1.5 text-[var(--theme-text)] hover:text-[var(--theme-secondary)] transition-colors"
            title={isRunning ? "Pause" : "Play"}
          >
            <HugeiconsIcon icon={isRunning ? PauseIcon : PlayIcon} size={20} />
          </button>
          <button
            onClick={next}
            className="p-1.5 text-[var(--theme-text)] hover:text-[var(--theme-secondary)] transition-colors"
            title="Next"
          >
            <HugeiconsIcon icon={NextIcon} size={20} />
          </button>
        </div>
      </div>
    </Draggable>
  );
}
