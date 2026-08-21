"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsSectionItem<T extends string> = { value: T; label: string; icon: LucideIcon };

type SettingsSectionNavProps<T extends string> = {
  items: readonly SettingsSectionItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  footer?: React.ReactNode;
};

export function SettingsSectionNav<T extends string>({ items, value, onValueChange, ariaLabel, footer }: SettingsSectionNavProps<T>) {
  return (
    <nav aria-label={ariaLabel} className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2 sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3">
      {items.map(({ value: itemValue, label, icon: Icon }) => (
        <button key={itemValue} type="button" onClick={() => onValueChange(itemValue)} aria-current={value === itemValue ? "page" : undefined} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]", value === itemValue && "bg-[var(--app-settings-active)] text-[var(--app-text)]")}>
          <Icon className="h-4 w-4" aria-hidden="true" />{label}
        </button>
      ))}
      {footer}
    </nav>
  );
}

export type { SettingsSectionItem };
