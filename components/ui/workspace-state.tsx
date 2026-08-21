import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type WorkspaceEmptyStateProps = React.HTMLAttributes<HTMLElement> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  dashed?: boolean;
};

function WorkspaceEmptyState({ title, description, icon, action, dashed, className, ...props }: WorkspaceEmptyStateProps) {
  return (
    <section className={cn("flex min-h-64 flex-col items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-6 text-center", dashed && "border-dashed border-[var(--app-border-strong)]", className)} {...props}>
      {icon}
      <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

type WorkspaceLoadingStateProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string;
  spinnerClassName?: string;
};

function WorkspaceLoadingState({ label = "Loading", spinnerClassName, className, ...props }: WorkspaceLoadingStateProps) {
  return (
    <div className={cn("flex min-h-48 items-center justify-center", className)} aria-label={label} {...props}>
      <Spinner className={spinnerClassName} aria-label={label} />
    </div>
  );
}

export { WorkspaceEmptyState, WorkspaceLoadingState };
