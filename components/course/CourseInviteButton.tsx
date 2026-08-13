"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";

type Grant = { id: string; user: { id: string; name: string; email: string } };

export function CourseInviteButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/access`);
      if (!response.ok) throw new Error();
      setGrants(await response.json());
    } catch {
      toast.error("Invitations could not be loaded.");
    }
  }, [courseId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const invite = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error ?? "Course access could not be granted.");
        return;
      }
      setEmail("");
      await load();
      toast.success("Course access granted.");
    } catch {
      toast.error("Course access could not be granted.");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (userId: string) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/access?userId=${userId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setGrants((current) => current.filter((grant) => grant.user.id !== userId));
      toast.success("Course access removed.");
    } catch {
      toast.error("Course access could not be removed.");
    }
  };

  return (
    <>
      <WorkspaceButton type="button" variant="secondary" size="compact" onClick={() => setOpen(true)}>
        <Mail className="h-2.5 w-2.5" />Invite
      </WorkspaceButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="course-dialog fixed bottom-0 left-0 top-auto flex max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-3xl border border-[var(--course-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl sm:left-[50%] sm:top-[50%] sm:max-h-[640px] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl">
          <div className="border-b border-[var(--course-line)] px-5 py-4 pr-12">
            <DialogTitle className="text-lg font-semibold">Course invitations</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-[var(--course-text-muted)]">Give specific people access to this invitation-only course.</DialogDescription>
          </div>
          <div className="course-scroll min-h-0 flex-1 overflow-y-auto p-5">
            <div className="flex gap-2">
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void invite(); }} placeholder="learner@example.com" aria-label="Learner email" className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-3 text-sm outline-none focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" />
              <WorkspaceButton type="button" variant="primary" onClick={() => void invite()} disabled={saving || !email.trim()}>{saving ? "Adding..." : "Add"}</WorkspaceButton>
            </div>
            <div className="mt-4 space-y-2">
              {grants.length === 0 ? (
                <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--course-line)] text-center"><Mail className="mb-2 h-5 w-5 text-[var(--course-text-faint)]" /><p className="text-sm font-medium text-[var(--course-text-muted)]">No invitations yet</p></div>
              ) : grants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{grant.user.name}</p><p className="mt-0.5 truncate text-xs text-[var(--course-text-muted)]">{grant.user.email}</p></div>
                  <WorkspaceButton type="button" variant="danger" size="icon" onClick={() => void revoke(grant.user.id)} aria-label={`Remove ${grant.user.name}`}><Trash2 className="h-4 w-4" /></WorkspaceButton>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--course-line)] px-5 py-4">
            <WorkspaceButton type="button" variant="secondary" onClick={() => setOpen(false)} className="w-full">Done</WorkspaceButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
