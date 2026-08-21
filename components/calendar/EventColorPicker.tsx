"use client";

import { cn } from "@/lib/utils";
import { EVENT_COLOR_OPTIONS } from "./event-palette";

export function EventColorPicker({ value, onValueChange, compact = false, className }: { value: string; onValueChange: (value: string) => void; compact?: boolean; className?: string }) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-xs font-semibold text-[var(--app-text-muted)]">Color</legend>
      <div className="flex flex-wrap gap-2">
        {EVENT_COLOR_OPTIONS.map((option) => (
          <button key={option.value} type="button" onClick={() => onValueChange(option.value)} aria-label={`Select ${option.label}`} aria-pressed={value === option.value} className={cn(compact ? "h-7 w-7" : "h-8 w-8", "rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]", value === option.value ? "scale-105 border-[var(--app-text)]" : "border-[var(--app-surface)]")} style={{ backgroundColor: option.value }} />
        ))}
      </div>
    </fieldset>
  );
}
