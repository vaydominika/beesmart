import * as React from "react";
import { cn } from "@/lib/utils";

type WorkspaceProgressProps = {
  value: number;
  label?: React.ReactNode;
  showValue?: boolean;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
};

function WorkspaceProgress({ value, label = "Progress", showValue = true, className, trackClassName, indicatorClassName }: WorkspaceProgressProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      {(label || showValue) ? <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-[var(--app-text-muted)]"><span>{label}</span>{showValue ? <span>{normalizedValue}%</span> : null}</div> : null}
      <div className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]", trackClassName)}>
        <div role="progressbar" aria-label={typeof label === "string" ? label : "Progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalizedValue} className={cn("h-full rounded-full bg-[var(--app-focus-border)] transition-[width]", indicatorClassName)} style={{ width: `${normalizedValue}%` }} />
      </div>
    </div>
  );
}

export { WorkspaceProgress };
