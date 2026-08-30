export const EVENT_COLOR_OPTIONS = [
  { value: "var(--app-event-1)", label: "Pollen" },
  { value: "var(--app-event-2)", label: "Coral" },
  { value: "var(--app-event-3)", label: "Lagoon" },
  { value: "var(--app-event-4)", label: "Sky" },
  { value: "var(--app-event-5)", label: "Sage" },
  { value: "var(--app-event-6)", label: "Honey" },
] as const;

export const DEFAULT_EVENT_COLOR = EVENT_COLOR_OPTIONS[0].value;
// The hex values match old records saved before calendar colors used CSS variables.
const LEGACY_DEFAULT_EVENT_COLORS = new Set([EVENT_COLOR_OPTIONS[5].value, "#FFEEAD", "#ffeead"]); // color-audit-ignore

export function calendarEventColor(event: Pick<ScheduleEvent, "color">): string {
  if (!event.color || LEGACY_DEFAULT_EVENT_COLORS.has(event.color)) return DEFAULT_EVENT_COLOR;
  return event.color;
}

export type EventSurfaceStyle = CSSProperties & { "--event-color": string };

export function eventSurfaceStyle(color?: string | null): EventSurfaceStyle {
  return { "--event-color": calendarEventColor({ color }) };
}
import type { CSSProperties } from "react";
import type { ScheduleEvent } from "@/lib/schedule";
