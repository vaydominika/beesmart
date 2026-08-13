"use client";

import { ArrowRight } from "lucide-react";
import { WorkspaceButton } from "@/components/ui/workspace-button";

export function BasedOnYourCoursesCard() {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--dashboard-line)] bg-[var(--dashboard-surface)] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08]"
        style={{ backgroundImage: "url('/svg/CardBackground.svg')" }}
      />
      <div className="relative z-10 min-w-0">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--dashboard-text)]">Hive picks</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dashboard-text-muted)]">
          Courses that match what you&apos;re already learning.
        </p>
        <WorkspaceButton
          type="button"
          variant="ghost"
          size="compact"
          className="mt-3 -ml-3"
          onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}
        >
          See recommendations <ArrowRight className="h-4 w-4" />
        </WorkspaceButton>
      </div>
    </section>
  );
}
