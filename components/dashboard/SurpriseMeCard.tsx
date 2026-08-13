"use client";

import { ArrowRight } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";

export function SurpriseMeCard() {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08]"
        style={{ backgroundImage: "url('/svg/CardBackground.svg')" }}
      />
      <div className="relative z-10 min-w-0">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--dashboard-text)]">Try something new</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dashboard-text-muted)]">
          Let the hive choose a course for you.
        </p>
        <WorkspaceButton
          type="button"
          variant="ghost"
          size="compact"
          className="mt-3 -ml-3"
          onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
        >
          Surprise me <ArrowRight className="h-4 w-4" />
        </WorkspaceButton>
      </div>
    </section>
  );
}
