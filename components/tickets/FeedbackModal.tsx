"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, MessageSquareText, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton, workspaceButtonVariants } from "@/components/ui/workspace-button";
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

type UploadedImage = {
  uploadId: string;
  fileName: string;
  previewUrl: string;
};

const MAX_IMAGES = 5;

export function FeedbackModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDescription("");
    setImages([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !submitting) reset();
    onOpenChange(nextOpen);
  };

  const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;
    if (selected.length > remaining) toast.info(`You can attach up to ${MAX_IMAGES} images.`);

    setUploading(true);
    setError(null);
    try {
      for (const file of selected.slice(0, remaining)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image.`);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", "TICKET_ATTACHMENT");
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.error ?? `${file.name} could not be uploaded.`);
          continue;
        }
        setImages((current) => [...current, result]);
      }
    } catch {
      toast.error("The images could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const content = description.trim();
    if (!content) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: content, uploadIds: images.map((image) => image.uploadId) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Feedback could not be sent");
      reset();
      onOpenChange(false);
      onSuccess?.();
      toast.success("Feedback sent");
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : "Feedback could not be sent";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <WorkspaceDialogContent className="max-w-xl">
        <WorkspaceDialogHeader>
          <WorkspaceDialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Early Access feedback
          </WorkspaceDialogTitle>
          <WorkspaceDialogDescription>Share a bug, suggestion, or anything that would make BeeSmart better.</WorkspaceDialogDescription>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="space-y-5">
          <div>
            <label htmlFor="feedback-description" className={workspaceLabelClass}>What happened?</label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              maxLength={10_000}
              placeholder="Describe what you noticed and what you expected to happen…"
              className={`${workspaceFieldClass} h-auto min-h-36 w-full resize-y py-3`}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className={workspaceLabelClass}>Screenshots <span className="font-normal text-[var(--app-text-faint)]">Optional</span></p>
                <p className="text-xs text-[var(--app-text-faint)]">Up to {MAX_IMAGES} images</p>
              </div>
              <label className={workspaceButtonVariants({ variant: "secondary", size: "compact", className: images.length >= MAX_IMAGES ? "pointer-events-none opacity-60" : "cursor-pointer" })}>
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Uploading…" : "Add images"}
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={uploadImages} disabled={uploading || images.length >= MAX_IMAGES} className="sr-only" />
              </label>
            </div>
            {images.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image) => (
                  <div key={image.uploadId} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]">
                    <Image src={image.previewUrl} alt={image.fileName} fill unoptimized className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((current) => current.filter((item) => item.uploadId !== image.uploadId))}
                      aria-label={`Remove ${image.fileName}`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-overlay)] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p role="alert" className="rounded-xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] px-3 py-2 text-sm text-[var(--app-danger)]">{error}</p> : null}
        </WorkspaceDialogBody>
        <WorkspaceDialogFooter>
          <WorkspaceButton type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="primary" onClick={submit} disabled={!description.trim() || uploading || submitting}>
            {submitting ? "Sending…" : "Send feedback"}
          </WorkspaceButton>
        </WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
