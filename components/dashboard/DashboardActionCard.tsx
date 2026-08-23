"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";

type DashboardActionCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  targetId?: string;
  actionPending?: boolean;
};

export function DashboardActionCard({ title, description, actionLabel, onAction, targetId, actionPending = false }: DashboardActionCardProps) {
  const handleAction = () => {
    if (onAction) return onAction();
    if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08]" style={{ backgroundImage: "url('/svg/CardBackground.svg')" }} />
      <div className="relative z-10 min-w-0">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--dashboard-text)]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dashboard-text-muted)]">{description}</p>
        <WorkspaceButton type="button" variant="ghost" size="compact" className="mt-3 -ml-3" onClick={handleAction} disabled={actionPending}>
          {actionPending ? "Choosing…" : actionLabel}
          {actionPending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        </WorkspaceButton>
      </div>
    </section>
  );
}
