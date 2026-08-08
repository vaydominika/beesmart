"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useSettings } from "@/components/settings/SettingsProvider";

type TimerMode = "active" | "break";
type FocusStats = { focusCount: number; breakCount: number };
type SessionConfig = { activeMinutes: number; breakMinutes: number; autoBreak: boolean };
type PhaseRecord = { completionId: string; type: TimerMode; durationSeconds: number; startedAt: string };

interface FocusContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  activeMinutes: number;
  breakMinutes: number;
  autoBreak: boolean;
  setActiveMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setAutoBreak: (enabled: boolean) => void;
  stats: FocusStats;
  isStatsLoading: boolean;
  statsError: string | null;
  loadStats: () => Promise<void>;
  isSessionActive: boolean;
  currentMode: TimerMode;
  timeRemaining: number;
  isRunning: boolean;
  isMinimized: boolean;
  startSession: (config?: SessionConfig) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopSession: () => void;
  switchMode: () => void;
  undo: () => void;
  next: () => void;
  toggleMinimize: () => void;
  widgetPosition: { x: number; y: number };
  setWidgetPosition: (position: { x: number; y: number }) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) throw new Error("useFocus must be used within FocusProvider");
  return context;
}

function completionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `focus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const { defaultActiveMinutes, defaultBreakMinutes, defaultAutoBreak, isHydrated } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMinutes, setActiveMinutes] = useState(defaultActiveMinutes);
  const [breakMinutes, setBreakMinutes] = useState(defaultBreakMinutes);
  const [autoBreak, setAutoBreak] = useState(defaultAutoBreak);
  const [stats, setStats] = useState<FocusStats>({ focusCount: 0, breakCount: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<TimerMode>("active");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState({ x: 20, y: 600 });
  const previousStateRef = useRef<{ timeRemaining: number; mode: TimerMode; isRunning: boolean } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef<PhaseRecord | null>(null);

  const loadStats = useCallback(async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch("/api/focus-sessions", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load focus statistics");
      setStats(await response.json());
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : "Could not load focus statistics");
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const persistCompletedPhase = useCallback(async (phase: PhaseRecord, endedAt: string) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/focus-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...phase, endedAt }),
        });
        if (!response.ok) throw new Error("Could not save the completed focus session");
        const data = await response.json();
        setStats(data.stats);
        setStatsError(null);
        return;
      } catch {
        if (attempt === 1) setStatsError("A completed session could not be saved. Your timer can continue.");
      }
    }
  }, []);

  const beginPhase = useCallback((type: TimerMode, minutes: number) => {
    phaseRef.current = {
      completionId: completionId(),
      type,
      durationSeconds: minutes * 60,
      startedAt: new Date().toISOString(),
    };
  }, []);

  useEffect(() => {
    if (!isSessionActive && isHydrated) {
      setActiveMinutes(defaultActiveMinutes);
      setBreakMinutes(defaultBreakMinutes);
      setAutoBreak(defaultAutoBreak);
    }
  }, [defaultActiveMinutes, defaultBreakMinutes, defaultAutoBreak, isHydrated, isSessionActive]);

  useEffect(() => {
    if (typeof window !== "undefined") setWidgetPosition({ x: 20, y: window.innerHeight - 200 });
  }, []);

  useEffect(() => {
    if (isRunning && isSessionActive) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((previous) => {
          if (previous <= 1) {
            const completed = phaseRef.current;
            phaseRef.current = null;
            if (completed) void persistCompletedPhase(completed, new Date().toISOString());
            if (currentMode === "active" && autoBreak) {
              setCurrentMode("break");
              beginPhase("break", breakMinutes);
              return breakMinutes * 60;
            }
            setIsRunning(false);
            return 0;
          }
          return previous - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isSessionActive, currentMode, autoBreak, breakMinutes, beginPhase, persistCompletedPhase]);

  const openModal = () => {
    setIsModalOpen(true);
    void loadStats();
  };
  const closeModal = () => setIsModalOpen(false);

  const startSession = (config?: SessionConfig) => {
    const nextActive = config?.activeMinutes ?? activeMinutes;
    const nextBreak = config?.breakMinutes ?? breakMinutes;
    const nextAutoBreak = config?.autoBreak ?? autoBreak;
    setActiveMinutes(nextActive);
    setBreakMinutes(nextBreak);
    setAutoBreak(nextAutoBreak);
    setIsSessionActive(true);
    setCurrentMode("active");
    setTimeRemaining(nextActive * 60);
    setIsRunning(true);
    setIsMinimized(false);
    beginPhase("active", nextActive);
    closeModal();
  };

  const pauseTimer = () => {
    previousStateRef.current = { timeRemaining, mode: currentMode, isRunning: true };
    setIsRunning(false);
  };
  const resumeTimer = () => setIsRunning(true);
  const stopSession = () => {
    phaseRef.current = null;
    setIsSessionActive(false);
    setIsRunning(false);
    setTimeRemaining(0);
    setCurrentMode("active");
    setIsMinimized(false);
  };
  const moveToMode = (mode: TimerMode) => {
    phaseRef.current = null;
    const minutes = mode === "active" ? activeMinutes : breakMinutes;
    setCurrentMode(mode);
    setTimeRemaining(minutes * 60);
    setIsRunning(true);
    beginPhase(mode, minutes);
  };
  const switchMode = () => moveToMode(currentMode === "active" ? "break" : "active");
  const next = switchMode;
  const undo = () => {
    if (!previousStateRef.current) return;
    setTimeRemaining(previousStateRef.current.timeRemaining);
    setCurrentMode(previousStateRef.current.mode);
    setIsRunning(previousStateRef.current.isRunning);
    previousStateRef.current = null;
  };

  return (
    <FocusContext.Provider value={{
      isModalOpen, openModal, closeModal,
      activeMinutes, breakMinutes, autoBreak, setActiveMinutes, setBreakMinutes, setAutoBreak,
      stats, isStatsLoading, statsError, loadStats,
      isSessionActive, currentMode, timeRemaining, isRunning, isMinimized,
      startSession, pauseTimer, resumeTimer, stopSession, switchMode, undo, next,
      toggleMinimize: () => setIsMinimized((value) => !value),
      widgetPosition, setWidgetPosition,
    }}>
      {children}
    </FocusContext.Provider>
  );
}
