"use client";

import { TimerReset } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
} from "@/components/ui/workspace-dialog";
import { useFocus } from "./FocusProvider";
import { WorkspaceSwitchRow } from "@/components/ui/workspace-switch-row";
import { WorkspaceFormMessage } from "@/components/ui/workspace-form-message";

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

          {statsError ? <WorkspaceFormMessage tone="status" className="border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] text-[var(--app-danger)]">{statsError}</WorkspaceFormMessage> : null}

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

          <WorkspaceSwitchRow id="focus-auto-break" label="Start break automatically" checked={autoBreak} onCheckedChange={setAutoBreak} />
        </WorkspaceDialogBody>

        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={closeModal}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={handleStart}>Start focus</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
