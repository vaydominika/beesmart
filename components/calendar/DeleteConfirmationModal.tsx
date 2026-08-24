"use client";

import { X } from "lucide-react";
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";

interface DeleteConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title?: string;
  description?: string;
}

export function DeleteConfirmationModal({ open, onClose, onConfirm, isDeleting, title = "Delete event", description = "Are you sure you want to delete this event? This action cannot be undone." }: DeleteConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isDeleting) onClose(); }}>
      <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog max-w-sm rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-2xl md:p-6">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-xl font-semibold text-[var(--classroom-text)]">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--classroom-text-muted)]">{description}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close delete confirmation" disabled={isDeleting} className="absolute right-4 top-4">
            <X className="h-4 w-4" aria-hidden="true" />
          </WorkspaceButton>
        </DialogClose>
        <div className="flex justify-end gap-2 pt-2">
          <WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</WorkspaceButton>
          <WorkspaceButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete"}</WorkspaceButton>
        </div>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
