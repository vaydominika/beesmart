"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type WorkspaceSwitchRowProps = {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  switchClassName?: string;
};

function WorkspaceSwitchRow({ id, label, checked, onCheckedChange, disabled, className, switchClassName }: WorkspaceSwitchRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-[var(--app-text)]">{label}</label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className={switchClassName} />
    </div>
  );
}

export { WorkspaceSwitchRow };
export type { WorkspaceSwitchRowProps };
