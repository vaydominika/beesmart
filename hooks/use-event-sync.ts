"use client";

import { useEffect, useCallback } from "react";

const EVENT_NAME = "calendar-events-updated";

export function useEventSync(onEventsUpdated?: () => void) {
    // Function to trigger the update
    const triggerUpdate = useCallback(() => {
        // Dispatch a custom event to the window
        window.dispatchEvent(new Event(EVENT_NAME));
    }, []);

    // Listen for the update
    useEffect(() => {
        if (!onEventsUpdated) return;

        const handleUpdate = () => {
            onEventsUpdated();
        };

        window.addEventListener(EVENT_NAME, handleUpdate);

        return () => {
            window.removeEventListener(EVENT_NAME, handleUpdate);
        };
    }, [onEventsUpdated]);

    return { triggerUpdate };
}
