import * as React from "react";
import { cn } from "@/lib/utils";

interface WorkspaceTabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

interface WorkspaceTabsProps<T extends string> {
  items: readonly WorkspaceTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  size?: "default" | "compact";
  fill?: boolean;
  className?: string;
  tabClassName?: string;
}

function WorkspaceTabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  size = "default",
  fill = false,
  className,
  tabClassName,
}: WorkspaceTabsProps<T>) {
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value));

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      className={cn(
        "relative inline-grid items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0.5",
        size === "compact" ? "h-8" : "h-9",
        fill && "w-full",
        className,
      )}
    >
      <span
        aria-hidden="true"
        data-slot="workspace-tabs-indicator"
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-lg bg-[var(--app-accent-soft)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 4px) / ${items.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative z-10 inline-flex min-w-0 items-center justify-center rounded-lg font-semibold text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--app-text-faint)]",
              size === "compact" ? "h-6 px-3 text-xs" : "h-7 px-3.5 text-sm",
              selected && "text-[var(--app-text)] hover:bg-transparent",
              tabClassName,
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export { WorkspaceTabs };
export type { WorkspaceTabItem, WorkspaceTabsProps };
