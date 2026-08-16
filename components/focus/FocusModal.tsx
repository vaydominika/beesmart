"use client";

import { TimerReset } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { useFocus } from "./FocusProvider";

export function FocusModal() {
  const {
    isModalOpen,
    closeModal,
    activeMinutes,
    breakMinutes,
    autoBreak,
    setActiveMinutes,
    setBreakMinutes,
    setAutoBreak,
    startSession,
    stats,
    isStatsLoading,
    statsError,
  } = useFocus();

  const handleStart = () => {
    const active = Math.min(120, Math.max(1, activeMinutes || 45));
    const breakMins = Math.min(60, Math.max(1, breakMinutes || 15));
    setActiveMinutes(active);
    setBreakMinutes(breakMins);
    startSession({ activeMinutes: active, breakMinutes: breakMins, autoBreak });
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <WorkspaceDialogContent className="max-w-md">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <TimerReset className="h-5 w-5" aria-hidden="true" />
            Focus session
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>Set a focused work block and an optional automatic break.</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>

        <WorkspaceDialogBody className="space-y-5">
          <div aria-label="All-time focus statistics" className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">Focus sessions</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{isStatsLoading ? "–" : stats.focusCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)] p-4">
              <p className="text-xs font-medium text-[var(--app-accent-text)]">Breaks</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--app-text)]">{isStatsLoading ? "–" : stats.breakCount}</p>
            </div>
          </div>

          {statsError ? <p role="status" className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-3 py-2 text-sm text-[var(--app-danger)]">{statsError}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="focus-active-minutes" className={workspaceLabelClass}>Focus minutes</label>
              <Input id="focus-active-minutes" type="number" value={activeMinutes || ""} onChange={(event) => setActiveMinutes(Number(event.target.value))} className={workspaceFieldClass} min="1" max="120" />
              <p className="mt-1 text-xs text-[var(--app-text-faint)]">1–120 minutes</p>
            </div>
            <div>
              <label htmlFor="focus-break-minutes" className={workspaceLabelClass}>Break minutes</label>
              <Input id="focus-break-minutes" type="number" value={breakMinutes || ""} onChange={(event) => setBreakMinutes(Number(event.target.value))} className={workspaceFieldClass} min="1" max="60" />
              <p className="mt-1 text-xs text-[var(--app-text-faint)]">1–60 minutes</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
            <div>
              <label htmlFor="focus-auto-break" className="text-sm font-semibold text-[var(--app-text)]">Start break automatically</label>
              <p className="mt-0.5 text-xs leading-4 text-[var(--app-text-muted)]">Move straight into the break when focus time ends.</p>
            </div>
            <Switch id="focus-auto-break" checked={autoBreak} onCheckedChange={setAutoBreak} />
          </div>
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={closeModal}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={handleStart}>Start focus</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
