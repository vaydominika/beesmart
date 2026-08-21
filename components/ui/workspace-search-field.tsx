"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceSearchFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  type?: "search" | "text";
  onClear?: () => void;
  wrapperClassName?: string;
  iconClassName?: string;
};

const WorkspaceSearchField = React.forwardRef<HTMLInputElement, WorkspaceSearchFieldProps>(
  ({ className, wrapperClassName, iconClassName, onClear, value, type = "text", ...props }, ref) => (
    <label className={cn("relative block min-w-0", wrapperClassName)}>
      <span className="sr-only">{props["aria-label"] ?? props.placeholder ?? "Search"}</span>
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-faint)]", iconClassName)} aria-hidden="true" />
      <input
        ref={ref}
        type={type}
        value={value}
        className={cn("h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] pl-9 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-faint)] focus:border-[var(--app-focus-border)] focus:ring-2 focus:ring-[var(--app-focus-ring)]", onClear ? "pr-9" : "pr-3", className)}
        {...props}
      />
      {onClear && value ? (
        <button type="button" onClick={onClear} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  ),
);
WorkspaceSearchField.displayName = "WorkspaceSearchField";

export { WorkspaceSearchField };
