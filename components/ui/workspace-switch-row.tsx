"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type WorkspaceSwitchRowProps = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  switchClassName?: string;
};

function WorkspaceSwitchRow({ id, label, description, checked, onCheckedChange, disabled, className, switchClassName }: WorkspaceSwitchRowProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4", className)}>
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-[var(--app-text)]">{label}</label>
        {description ? <p id={descriptionId} className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={descriptionId} className={switchClassName} />
    </div>
  );
}

export { WorkspaceSwitchRow };
export type { WorkspaceSwitchRowProps };
