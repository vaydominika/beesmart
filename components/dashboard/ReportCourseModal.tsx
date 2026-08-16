"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceSelect, type WorkspaceSelectOption } from "@/components/ui/workspace-select";
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

interface ReportCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string | null;
  courseTitle: string;
  onSuccess?: () => void;
}

type ReportReason = "" | "Inappropriate content" | "Incorrect or misleading information" | "Copyright violation" | "Spam or advertising" | "Other";
const REPORT_REASONS: readonly WorkspaceSelectOption<ReportReason>[] = [
  { value: "", label: "Select a reason", disabled: true },
  { value: "Inappropriate content", label: "Inappropriate content" },
  { value: "Incorrect or misleading information", label: "Incorrect or misleading information" },
  { value: "Copyright violation", label: "Copyright violation" },
  { value: "Spam or advertising", label: "Spam or advertising" },
  { value: "Other", label: "Other" },
];

export function ReportCourseModal({ open, onOpenChange, courseId, courseTitle, onSuccess }: ReportCourseModalProps) {
  const [reason, setReason] = useState<ReportReason>("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason("");
    setDescription("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!courseId || !reason) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description: description.trim() || undefined }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error ?? "Failed to submit report");
      reset();
      toast.success("Report submitted");
      onOpenChange(false);
      onSuccess?.();
    } catch (submitFailure) {
      const message = submitFailure instanceof Error ? submitFailure.message : "Failed to submit report";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <WorkspaceDialogContent className="max-w-lg">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Report course
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>Tell us what needs review in “{courseTitle || "this course"}”.</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="space-y-5">
          <div>
            <label id="report-reason-label" className={workspaceLabelClass}>Reason</label>
            <WorkspaceSelect value={reason} options={REPORT_REASONS} onValueChange={setReason} ariaLabel="Report reason" className="w-full" />
          </div>
          <div>
            <label htmlFor="report-details" className={workspaceLabelClass}>Additional details <span className="font-normal text-[var(--app-text-faint)]">Optional</span></label>
            <textarea id="report-details" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Describe the issue and where it appears…" className={`${workspaceFieldClass} h-auto min-h-28 w-full resize-y py-3`} />
          </div>
          {error ? <p role="alert" className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-3 py-2 text-sm text-[var(--app-danger)]">{error}</p> : null}
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={loading}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="danger" onClick={handleSubmit} disabled={!reason || loading}>{loading ? "Submitting…" : "Submit report"}</WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
