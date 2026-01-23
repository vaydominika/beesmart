"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

type TimerMode = "active" | "break";

interface FocusContextType {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // Timer state
  activeMinutes: number;
  breakMinutes: number;
  autoBreak: boolean;
  setActiveMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setAutoBreak: (enabled: boolean) => void;
  
  // Session state
  isSessionActive: boolean;
  currentMode: TimerMode;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  isMinimized: boolean;
  
  // Timer controls
  startSession: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopSession: () => void;
  switchMode: () => void;
  undo: () => void;
  next: () => void;
  toggleMinimize: () => void;
  
  // Widget position
  widgetPosition: { x: number; y: number };
  setWidgetPosition: (position: { x: number; y: number }) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within FocusProvider");
  }
  return context;
}

export function FocusProvider({ children }: { children: ReactNode }) {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Timer settings
  const [activeMinutes, setActiveMinutes] = useState(45);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [autoBreak, setAutoBreak] = useState(true);
  
  // Session state
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentMode, setCurrentMode] = useState<TimerMode>("active");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Widget position (default: bottom-left corner)
  const [widgetPosition, setWidgetPosition] = useState({ x: 20, y: 600 });
  
  // Store previous state for undo
  const previousStateRef = useRef<{
    timeRemaining: number;
    mode: TimerMode;
    isRunning: boolean;
  } | null>(null);
  
  // Timer interval ref
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize widget position on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWidgetPosition({ x: 20, y: window.innerHeight - 200 });
    }
  }, []);
  
  // Timer countdown logic
  useEffect(() => {
    if (isRunning && isSessionActive) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer reached 0
            if (currentMode === "active" && autoBreak) {
              // Auto-switch to break if enabled
              setCurrentMode("break");
              return breakMinutes * 60;
            } else {
              // Stop timer
              setIsRunning(false);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isSessionActive, currentMode, autoBreak, breakMinutes]);
  
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  const startSession = () => {
    setIsSessionActive(true);
    setCurrentMode("active");
    setTimeRemaining(activeMinutes * 60);
    setIsRunning(true);
    setIsMinimized(false);
    closeModal();
  };
  
  const pauseTimer = () => {
    previousStateRef.current = {
      timeRemaining,
      mode: currentMode,
      isRunning: true,
    };
    setIsRunning(false);
  };
  
  const resumeTimer = () => {
    setIsRunning(true);
  };
  
  const stopSession = () => {
    setIsSessionActive(false);
    setIsRunning(false);
    setTimeRemaining(0);
    setCurrentMode("active");
    setIsMinimized(false);
  };
  
  const switchMode = () => {
    if (currentMode === "active") {
      setCurrentMode("break");
      setTimeRemaining(breakMinutes * 60);
    } else {
      setCurrentMode("active");
      setTimeRemaining(activeMinutes * 60);
    }
    setIsRunning(true);
  };
  
  const undo = () => {
    if (previousStateRef.current) {
      setTimeRemaining(previousStateRef.current.timeRemaining);
      setCurrentMode(previousStateRef.current.mode);
      setIsRunning(previousStateRef.current.isRunning);
      previousStateRef.current = null;
    }
  };
  
  const next = () => {
    if (currentMode === "active") {
      // Skip to break
      setCurrentMode("break");
      setTimeRemaining(breakMinutes * 60);
    } else {
      // Skip to next active session
      setCurrentMode("active");
      setTimeRemaining(activeMinutes * 60);
    }
    setIsRunning(true);
  };
  
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };
  
  return (
    <FocusContext.Provider
      value={{
        isModalOpen,
        openModal,
        closeModal,
        activeMinutes,
        breakMinutes,
        autoBreak,
        setActiveMinutes,
        setBreakMinutes,
        setAutoBreak,
        isSessionActive,
        currentMode,
        timeRemaining,
        isRunning,
        isMinimized,
        startSession,
        pauseTimer,
        resumeTimer,
        stopSession,
        switchMode,
        undo,
        next,
        toggleMinimize,
        widgetPosition,
        setWidgetPosition,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}
