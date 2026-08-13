"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import type { CourseAudit } from "@/lib/course-audit";

export function CourseAuditDialog({ open, onOpenChange, courseId, onSelectLesson }: { open: boolean; onOpenChange: (open: boolean) => void; courseId: string; onSelectLesson: (lessonId: string) => void }) {
  const [audit, setAudit] = useState<CourseAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/audit`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Course audit failed");
      setAudit(result.audit);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Course audit failed");
    } finally {
      setLoading(false);
    }
  };

  const followIssue = (lessonId?: string | null) => {
    if (!lessonId) return;
    onSelectLesson(lessonId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-[var(--course-line)] bg-[var(--app-surface)]">
        <DialogHeader><DialogTitle>Course audit</DialogTitle></DialogHeader>
        {!audit && !loading && !error && <div className="py-12 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[var(--course-text-faint)]" /><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--course-text-muted)]">Review pedagogical quality, accessibility, structure, and safety. The report stays in this session and never edits the course.</p><WorkspaceButton type="button" variant="primary" onClick={() => void runAudit()} className="mt-5">Run audit</WorkspaceButton></div>}
        {loading && <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-[var(--course-text-muted)]"><Loader2 className="h-5 w-5 animate-spin" /> Auditing the course...</div>}
        {error && <div className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] p-4 text-sm text-[var(--app-danger)]"><p>{error}</p><WorkspaceButton type="button" variant="secondary" onClick={() => void runAudit()} className="mt-3">Retry</WorkspaceButton></div>}
        {audit && !loading && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2"><Score label="Overall" value={audit.overallScore} /><Score label="Accessibility" value={audit.accessibilityScore} /></div>
          <section><h3 className="font-semibold">Summary</h3><p className="mt-2 text-sm leading-6 text-[var(--course-text-muted)]">{audit.summary}</p></section>
          <section><h3 className="font-semibold">Strengths</h3><ul className="mt-2 space-y-2">{audit.strengths.map((item, index) => <li key={index} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-success)]" />{item}</li>)}</ul></section>
          {audit.safetyFlags.length > 0 && <section className="rounded-xl border border-[var(--app-warning-border)] bg-[var(--app-warning-soft)] p-4"><h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Safety flags</h3><div className="mt-3 space-y-3">{audit.safetyFlags.map((flag, index) => <button key={index} type="button" disabled={!flag.lessonId} onClick={() => followIssue(flag.lessonId)} className="block w-full rounded-lg bg-[var(--app-surface)] p-3 text-left text-sm disabled:cursor-default"><strong>{flag.reason}</strong><span className="mt-1 block text-xs text-[var(--course-text-muted)]">{flag.contentSnippet}</span></button>)}</div></section>}
          <section><h3 className="font-semibold">Issues to review</h3><div className="mt-3 space-y-3">{(["HIGH", "MEDIUM", "LOW"] as const).map((severity) => {
            const issues = audit.qualityIssues.filter((issue) => issue.severity === severity);
            if (!issues.length) return null;
            return <div key={severity}><p className="mb-2 text-xs font-semibold uppercase text-[var(--course-text-muted)]">{severity} · {issues.length}</p>{issues.map((issue, index) => <button key={index} type="button" disabled={!issue.lessonId} onClick={() => followIssue(issue.lessonId)} className="mb-2 block w-full rounded-xl border border-[var(--course-line)] p-3 text-left disabled:cursor-default"><span className="text-sm font-semibold">{issue.issue}</span><span className="mt-1 block text-sm text-[var(--course-text-muted)]">{issue.suggestion}</span>{issue.lessonId && <span className="mt-2 block text-xs font-medium">Open lesson</span>}</button>)}</div>;
          })}</div></section>
          <div className="flex justify-end"><WorkspaceButton type="button" variant="secondary" onClick={() => void runAudit()}>Run again</WorkspaceButton></div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[var(--course-surface-muted)] p-4"><p className="text-xs font-medium text-[var(--course-text-muted)]">{label} score</p><p className="mt-1 text-3xl font-semibold">{Math.round(value)}<span className="text-sm text-[var(--course-text-muted)]">/100</span></p></div>;
}
