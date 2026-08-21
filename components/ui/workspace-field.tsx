import * as React from "react";
import { cn } from "@/lib/utils";
import { workspaceLabelClass } from "@/components/ui/workspace-dialog";

type WorkspaceFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  labelClassName?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
};

function WorkspaceField({ id, label, hint, error, labelClassName, children, className, ...props }: WorkspaceFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className} {...props}>
      <label htmlFor={id} className={cn(workspaceLabelClass, labelClassName)}>{label}</label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error) || undefined,
      })}
      {hint ? <p id={hintId} className="mt-1.5 text-xs text-[var(--app-text-faint)]">{hint}</p> : null}
      {error ? <p id={errorId} className="mt-1.5 text-xs text-[var(--app-danger)]">{error}</p> : null}
    </div>
  );
}

export { WorkspaceField };
export type { WorkspaceFieldProps };
