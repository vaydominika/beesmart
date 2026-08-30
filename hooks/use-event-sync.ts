"use client";

import { useEffect, useCallback } from "react";

const EVENT_NAME = "calendar-events-updated";
const STORAGE_KEY = "beesmart:calendar-events-updated";

export function useEventSync(onEventsUpdated?: () => void) {
    const triggerUpdate = useCallback(() => {
        window.dispatchEvent(new Event(EVENT_NAME));
        try {
            window.localStorage.setItem(STORAGE_KEY, `${Date.now()}:${Math.random()}`);
        } catch {
            // The in-page event still keeps the current tab synchronized when storage is unavailable.
        }
    }, []);

    useEffect(() => {
        if (!onEventsUpdated) return;

        const handleUpdate = () => onEventsUpdated();
        const handleStorage = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY) onEventsUpdated();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") onEventsUpdated();
        };

        window.addEventListener(EVENT_NAME, handleUpdate);
        window.addEventListener("storage", handleStorage);
        window.addEventListener("focus", handleUpdate);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener(EVENT_NAME, handleUpdate);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", handleUpdate);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [onEventsUpdated]);

    return { triggerUpdate };
}
