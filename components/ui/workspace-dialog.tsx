"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type WorkspaceDialogContentProps = React.ComponentProps<typeof DialogContent> & {
  mobileSheet?: boolean;
};

function WorkspaceDialogContent({ className, children, mobileSheet = true, ...props }: WorkspaceDialogContentProps) {
  return (
    <DialogContent
      className={cn(
        "workspace-dialog flex max-h-[min(88vh,760px)] w-[calc(100vw-24px)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0 font-[var(--font-geist-sans)] text-[var(--app-text)] shadow-[var(--app-shadow-elevated)]",
        mobileSheet && "max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function WorkspaceDialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogHeader
      className={cn("relative shrink-0 space-y-1 border-b border-[var(--app-border)] px-5 py-4 pr-14 text-left sm:px-6", className)}
      {...props}
    >
      {children}
      <DialogClose className="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]">
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogHeader>
  );
}

function WorkspaceDialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("text-lg font-semibold tracking-[-0.02em] text-[var(--app-text)]", className)} {...props} />;
}

function WorkspaceDialogDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn("text-sm leading-5 text-[var(--app-text-muted)]", className)} {...props} />;
}

function WorkspaceDialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", className)} {...props} />;
}

function WorkspaceDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("shrink-0 gap-2 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 sm:px-6", className)}
      {...props}
    />
  );
}

const workspaceFieldClass = "h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 font-[var(--font-geist-sans)] text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] focus-visible:border-[var(--app-focus-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]";
const workspaceLabelClass = "mb-1.5 block text-xs font-semibold text-[var(--app-text-muted)]";

export {
  WorkspaceDialogBody,
  WorkspaceDialogContent,
  WorkspaceDialogDescription,
  WorkspaceDialogFooter,
  WorkspaceDialogHeader,
  WorkspaceDialogTitle,
  workspaceFieldClass,
  workspaceLabelClass,
};
