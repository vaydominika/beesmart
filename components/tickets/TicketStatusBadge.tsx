import type { ReportStatus } from "@/lib/generated/prisma";
import { reportStatusLabel } from "@/lib/ticket-types";
import { cn } from "@/lib/utils";

const statusClasses: Record<ReportStatus, string> = {
  OPEN: "border-[var(--app-info-border)] bg-[var(--app-info-soft)] text-[var(--app-info)]",
  IN_PROGRESS: "border-[var(--app-warning-border)] bg-[var(--app-warning-soft)] text-[var(--app-warning)]",
  RESOLVED: "border-[var(--app-success-border)] bg-[var(--app-success-soft)] text-[var(--app-success)]",
  CLOSED: "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]",
};

export function TicketStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={cn("inline-flex h-7 items-center rounded-full border px-2.5 font-[var(--font-geist-sans)] text-[11px] font-semibold", statusClasses[status])}>
      {reportStatusLabel(status)}
    </span>
  );
}
