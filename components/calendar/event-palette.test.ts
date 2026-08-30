import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_COLOR,
  calendarEventColor,
  eventSurfaceStyle,
} from "./event-palette";

describe("calendarEventColor", () => {
  it("upgrades old lighter defaults to the darker Pollen color", () => {
    expect(calendarEventColor({ color: "var(--app-event-6)" })).toBe(DEFAULT_EVENT_COLOR);
    expect(calendarEventColor({ color: "#FFEEAD" })).toBe(DEFAULT_EVENT_COLOR);
    expect(eventSurfaceStyle("var(--app-event-6)")).toEqual({ "--event-color": DEFAULT_EVENT_COLOR });
  });

  it("preserves intentionally selected colors and falls back to Pollen", () => {
    expect(calendarEventColor({ color: "#123456" })).toBe("#123456");
    expect(calendarEventColor({ color: null })).toBe(DEFAULT_EVENT_COLOR);
  });
});
