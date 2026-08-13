"use client";

import * as React from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkspaceSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface WorkspaceSelectProps<T extends string> {
  value: T;
  options: readonly WorkspaceSelectOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  id?: string;
  placeholder?: string;
  triggerIcon?: LucideIcon;
  size?: "default" | "compact";
  align?: "start" | "center" | "end";
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

function WorkspaceSelect<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  id,
  placeholder = "Select an option",
  triggerIcon,
  size = "default",
  align = "start",
  disabled = false,
  className,
  contentClassName,
}: WorkspaceSelectProps<T>) {
  const selected = options.find((option) => option.value === value);
  const LeadingIcon = triggerIcon ?? selected?.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)] focus-visible:border-[var(--app-focus-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:text-[var(--app-text-faint)]",
            size === "compact" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
            className,
          )}
        >
          {LeadingIcon ? <LeadingIcon className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" aria-hidden="true" /> : null}
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--app-text-muted)]" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        aria-label={`${ariaLabel} options`}
        className={cn(
          "z-[80] w-[var(--radix-dropdown-menu-trigger-width)] min-w-40 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 text-[var(--app-text)] shadow-[var(--app-shadow-soft)] motion-reduce:animate-none",
          contentClassName,
        )}
      >
        {options.map((option) => {
          const OptionIcon = option.icon;
          const selectedOption = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled}
              onSelect={() => onValueChange(option.value)}
              className={cn(
                "h-9 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-[var(--app-text-muted)] focus:bg-[var(--app-surface-muted)] focus:text-[var(--app-text)]",
                selectedOption && "bg-[var(--app-accent-soft)] text-[var(--app-text)]",
              )}
            >
              {OptionIcon ? <OptionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {selectedOption ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { WorkspaceSelect };
export type { WorkspaceSelectOption, WorkspaceSelectProps };
