"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
} from "@/components/ui/workspace-dialog";

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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <WorkspaceDialogContent mobileSheet={false} className="max-w-sm rounded-2xl">
        <WorkspaceDialogHeader className="border-b-0 pb-2">
          <WorkspaceDialogTitle className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-danger-soft)] text-[var(--app-danger)]"><AlertTriangle className="h-4 w-4" /></span>{title}</WorkspaceDialogTitle>
        </WorkspaceDialogHeader>
        <WorkspaceDialogBody className="pt-1"><p className="text-sm leading-6 text-[var(--app-text-muted)]">{description}</p></WorkspaceDialogBody>
        <WorkspaceDialogFooter><WorkspaceButton type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</WorkspaceButton><WorkspaceButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? <><Spinner className="h-4 w-4" />Deleting…</> : "Delete"}</WorkspaceButton></WorkspaceDialogFooter>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
