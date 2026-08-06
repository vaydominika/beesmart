"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface CourseRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  courseTitle?: string;
  onSaved?: (result: { averageRating: number | null; ratingCount: number }) => void;
}

export function CourseRatingModal({ open, onOpenChange, courseId, courseTitle, onSaved }: CourseRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    if (!open || !courseId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/courses/${courseId}/rate`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Rating could not be loaded");
        if (!active) return;
        setRating(data.currentRating?.rating ?? 0);
        setComment(data.currentRating?.comment ?? "");
        setExisting(Boolean(data.currentRating));
      })
      .catch((error) => active && toast.error(error instanceof Error ? error.message : "Rating could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId, open]);

  const save = async () => {
    if (!courseId || rating < 1) {
      toast.error("Choose a star rating first.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Rating could not be saved");
      toast.success(existing ? "Rating updated." : "Thanks for rating this course.");
      onSaved?.({ averageRating: data.averageRating ?? null, ratingCount: data.ratingCount ?? 0 });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rating could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="course-ui max-w-md rounded-2xl border border-[var(--course-line-strong)] bg-white p-6 shadow-2xl">
        <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" className="absolute right-4 top-4" aria-label="Close rating"><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-xl font-semibold text-[var(--course-text)]">{existing ? "Update your rating" : "How was the course?"}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-[var(--course-text-muted)]">Your feedback helps other learners understand {courseTitle || "this course"}.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex min-h-48 items-center justify-center"><Spinner /></div> : (
          <div className="mt-5 space-y-5">
            <div role="radiogroup" aria-label="Course rating" className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)} className="rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-ring)]">
                  <Star className={cn("h-8 w-8 transition-colors", value <= rating ? "fill-amber-400 text-amber-500" : "text-[var(--course-line-strong)]")} />
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium text-[var(--course-text)]">Optional comment<textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--course-focus-border)] focus:ring-2 focus:ring-[var(--course-focus-ring)]" placeholder="What worked well? What could be clearer?" /><span className="mt-1 block text-right text-[10px] text-[var(--course-text-faint)]">{comment.length}/500</span></label>
            <div className="flex justify-end gap-2"><WorkspaceButton type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Maybe later</WorkspaceButton><WorkspaceButton type="button" variant="primary" onClick={() => void save()} disabled={saving || rating < 1}>{saving ? "Saving..." : "Save rating"}</WorkspaceButton></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
