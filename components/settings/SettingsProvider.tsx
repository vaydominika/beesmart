"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

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

  // Persistence
  saveSettingsToServer: (overrides?: Record<string, unknown>) => Promise<boolean>;
  isSaving: boolean;
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

function loadLocalSettings() {
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

function saveLocalSettings(settings: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load from localStorage as instant fallback
  const saved = loadLocalSettings();

  const [theme, setTheme] = useState<Theme>(saved?.theme || "bee");
  const [defaultActiveMinutes, setDefaultActiveMinutes] = useState(saved?.defaultActiveMinutes || 45);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(saved?.defaultBreakMinutes || 15);
  const [defaultAutoBreak, setDefaultAutoBreak] = useState(saved?.defaultAutoBreak ?? true);
  const [emailNotifications, setEmailNotifications] = useState(saved?.emailNotifications ?? true);
  const [reminderNotifications, setReminderNotifications] = useState(saved?.reminderNotifications ?? true);
  const [courseAlerts, setCourseAlerts] = useState(saved?.courseAlerts ?? true);
  const [profileVisibility, setProfileVisibility] = useState<"public" | "private">(saved?.profileVisibility || "public");
  const [activitySharing, setActivitySharing] = useState(saved?.activitySharing ?? true);

  // Load settings from the server on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (!res.ok) return; // Not logged in or server error — keep localStorage values
        const data = await res.json();
        setTheme(data.theme || "bee");
        setDefaultActiveMinutes(data.defaultActiveMinutes ?? 45);
        setDefaultBreakMinutes(data.defaultBreakMinutes ?? 15);
        setDefaultAutoBreak(data.defaultAutoBreak ?? true);
        setEmailNotifications(data.emailNotifications ?? true);
        setReminderNotifications(data.reminderNotifications ?? true);
        setCourseAlerts(data.courseAlerts ?? true);
        setProfileVisibility(data.profileVisibility || "public");
        setActivitySharing(data.activitySharing ?? true);
      } catch {
        // Network error — keep localStorage values
      }
    }
    fetchSettings();
  }, []);

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
    saveLocalSettings({
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

  // Save settings to the server (overrides let callers pass freshly-computed values that haven't hit state yet)
  const saveSettingsToServer = useCallback(async (overrides?: Record<string, unknown>): Promise<boolean> => {
    setIsSaving(true);
    try {
      const payload = {
        theme,
        defaultActiveMinutes,
        defaultBreakMinutes,
        defaultAutoBreak,
        emailNotifications,
        reminderNotifications,
        courseAlerts,
        profileVisibility,
        activitySharing,
        ...overrides,
      };
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
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
        saveSettingsToServer,
        isSaving,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
