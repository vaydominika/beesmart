export const EVENT_COLOR_OPTIONS = [
  { value: "var(--app-event-1)", label: "Pollen" },
  { value: "var(--app-event-2)", label: "Coral" },
  { value: "var(--app-event-3)", label: "Lagoon" },
  { value: "var(--app-event-4)", label: "Sky" },
  { value: "var(--app-event-5)", label: "Sage" },
  { value: "var(--app-event-6)", label: "Honey" },
] as const;

export const DEFAULT_EVENT_COLOR = EVENT_COLOR_OPTIONS[0].value;
