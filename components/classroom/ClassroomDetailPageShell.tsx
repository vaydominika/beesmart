"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { WorkspacePageFrame } from "@/components/ui/workspace-page";

export function ClassroomDetailPageShell({ classroomId, classroomName, detailTitle, children }: { classroomId: string; classroomName: string; detailTitle: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <WorkspacePageFrame className="classroom-ui bg-[var(--classroom-canvas)]" contentClassName="space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => router.push(`/classroom/${classroomId}?tab=Grades`)} aria-label={`Back to ${classroomName} grades`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] text-[var(--classroom-text-muted)] hover:bg-[var(--classroom-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--classroom-text)] md:text-2xl">{classroomName}</h1>
          <span aria-hidden="true" className="text-xl font-light text-[var(--classroom-text-faint)]">/</span>
          <h2 className="text-xl font-medium tracking-tight text-[var(--classroom-text-muted)] md:text-2xl">{detailTitle}</h2>
        </div>
      </div>
      {children}
    </WorkspacePageFrame>
  );
}
