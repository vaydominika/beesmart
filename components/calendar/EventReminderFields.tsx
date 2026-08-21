"use client";

import { useId, type ReactNode } from "react";
import { BellRing } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type EventReminderFieldsProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  date: string;
  onDateChange: (date: string) => void;
  time: string;
  onTimeChange: (time: string) => void;
  notificationsEnabled: boolean;
  maxDate?: string;
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
};

export function EventReminderFields({ enabled, onEnabledChange, date, onDateChange, time, onTimeChange, notificationsEnabled, maxDate, className, inputClassName, children }: EventReminderFieldsProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("rounded-2xl border border-[var(--app-border)] p-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-3"><BellRing className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h3 id={headingId} className="text-sm font-semibold text-[var(--app-text)]">Event reminder</h3><p className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">{notificationsEnabled ? "Get an in-app notification before this event." : "Reminder notifications are off in Settings."}</p></div></div>
        <Switch checked={enabled} disabled={!notificationsEnabled && !enabled} onCheckedChange={onEnabledChange} aria-label="Event reminder" />
      </div>
      {enabled ? <div className="mt-4 grid grid-cols-2 gap-2"><Input type="date" aria-label="Reminder date" value={date} max={maxDate} onChange={(event) => onDateChange(event.target.value)} className={inputClassName} /><Input type="time" aria-label="Reminder time" value={time} onChange={(event) => onTimeChange(event.target.value)} className={inputClassName} /></div> : null}
      {children}
    </section>
  );
}
