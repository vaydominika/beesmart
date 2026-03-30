import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEventSync } from './use-event-sync';

describe('useEventSync', () => {
    const EVENT_NAME = "calendar-events-updated";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should dispatch a custom event when triggerUpdate is called', () => {
        const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useEventSync());

        act(() => {
            result.current.triggerUpdate();
        });

        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
        expect(dispatchEventSpy.mock.calls[0][0].type).toBe(EVENT_NAME);
    });

    it('should call the callback when the custom event is dispatched', () => {
        const callback = vi.fn();
        renderHook(() => useEventSync(callback));

        act(() => {
            window.dispatchEvent(new Event(EVENT_NAME));
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clean up the event listener on unmount', () => {
        const callback = vi.fn();
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderHook(() => useEventSync(callback));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith(EVENT_NAME, expect.any(Function));
    });

    it('should not add a listener if no callback is provided', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        renderHook(() => useEventSync());

        // Initial calls like 'DOMContentLoaded' might be there, so check for EVENT_NAME specifically
        const eventListenerCalled = addEventListenerSpy.mock.calls.some(call => call[0] === EVENT_NAME);
        expect(eventListenerCalled).toBe(false);
    });
});
