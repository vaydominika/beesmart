"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "bee" | "dark" | "ocean" | "forest";

interface SettingsContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  // Focus Timer Defaults
  defaultActiveMinutes: number;
  defaultBreakMinutes: number;
  defaultAutoBreak: boolean;
  setDefaultActiveMinutes: (minutes: number) => void;
  setDefaultBreakMinutes: (minutes: number) => void;
  setDefaultAutoBreak: (enabled: boolean) => void;
  
  // Notifications
  emailNotifications: boolean;
  reminderNotifications: boolean;
  courseAlerts: boolean;
  setEmailNotifications: (enabled: boolean) => void;
  setReminderNotifications: (enabled: boolean) => void;
  setCourseAlerts: (enabled: boolean) => void;
  
  // Privacy
  profileVisibility: "public" | "private";
  activitySharing: boolean;
  setProfileVisibility: (visibility: "public" | "private") => void;
  setActivitySharing: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}

const STORAGE_KEY = "beesmart-settings";

function loadSettings() {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function saveSettings(settings: Partial<SettingsContextType>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Load from localStorage or use defaults
  const saved = loadSettings();
  
  const [theme, setTheme] = useState<Theme>(saved?.theme || "bee");
  const [defaultActiveMinutes, setDefaultActiveMinutes] = useState(saved?.defaultActiveMinutes || 45);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(saved?.defaultBreakMinutes || 15);
  const [defaultAutoBreak, setDefaultAutoBreak] = useState(saved?.defaultAutoBreak ?? true);
  const [emailNotifications, setEmailNotifications] = useState(saved?.emailNotifications ?? true);
  const [reminderNotifications, setReminderNotifications] = useState(saved?.reminderNotifications ?? true);
  const [courseAlerts, setCourseAlerts] = useState(saved?.courseAlerts ?? true);
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(saved?.profileVisibility || "public");
  const [activitySharing, setActivitySharing] = useState(saved?.activitySharing ?? true);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    if (theme !== "bee") {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettings({
      theme,
      defaultActiveMinutes,
      defaultBreakMinutes,
      defaultAutoBreak,
      emailNotifications,
      reminderNotifications,
      courseAlerts,
      profileVisibility,
      activitySharing,
    });
  }, [theme, defaultActiveMinutes, defaultBreakMinutes, defaultAutoBreak,
      emailNotifications, reminderNotifications, courseAlerts, profileVisibility, activitySharing]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

  return (
    <SettingsContext.Provider
      value={{
        isModalOpen,
        openModal,
        closeModal,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        theme,
        setTheme,
        defaultActiveMinutes,
        defaultBreakMinutes,
        defaultAutoBreak,
        setDefaultActiveMinutes,
        setDefaultBreakMinutes,
        setDefaultAutoBreak,
        emailNotifications,
        reminderNotifications,
        courseAlerts,
        setEmailNotifications,
        setReminderNotifications,
        setCourseAlerts,
        profileVisibility,
        activitySharing,
        setProfileVisibility,
        setActivitySharing,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
