import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceCheckboxProps extends Omit<React.ComponentProps<"input">, "type" | "onChange"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  containerClassName?: string;
  indicatorClassName?: string;
}

function WorkspaceCheckbox({
  label,
  description,
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
  className,
  containerClassName,
  indicatorClassName,
  ...props
}: WorkspaceCheckboxProps) {
  return (
    <label
      className={cn(
        "group flex min-h-9 cursor-pointer gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--app-text-muted)]",
        description ? "items-start" : "items-center",
        disabled && "pointer-events-none cursor-not-allowed text-[var(--app-text-faint)]",
        containerClassName,
      )}
    >
      <span className={cn("relative flex h-4 w-4 shrink-0", description && "mt-0.5")}>
        <input
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          className={cn("peer sr-only", className)}
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn("flex h-4 w-4 items-center justify-center rounded-[5px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text)] transition-colors group-hover:border-[var(--app-focus-border)] peer-checked:border-[var(--app-focus-border)] peer-checked:bg-[var(--app-accent-soft)] peer-checked:[&_svg]:block peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--app-focus-ring)] peer-focus-visible:ring-offset-1 peer-disabled:bg-[var(--app-surface-muted)]", indicatorClassName)}
        >
          <Check className="hidden h-3 w-3 stroke-[2.5]" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-[var(--app-text)]">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{description}</span> : null}
      </span>
    </label>
  );
}

export { WorkspaceCheckbox };
export type { WorkspaceCheckboxProps };
