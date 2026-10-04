"use client";

import { useText } from "@/i18n/use-text";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ClassroomWorkEditModal } from "@/components/calendar/ClassroomWorkEditModal";
import { DeleteConfirmationModal } from "@/components/calendar/DeleteConfirmationModal";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { toast } from "@/components/ui/sonner";
import { useEventSync } from "@/hooks/use-event-sync";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ClassroomWorkEditButtonProps {
    classroomId: string;
    title: string;
    assignmentId?: string;
    testId?: string;
    workType?: "assignment" | "test" | "exam";
    onSaved?: () => void | Promise<void>;
    onDeleted?: () => void | Promise<void>;
    className?: string;
}

export function ClassroomWorkEditButton({
    classroomId,
    title,
    assignmentId,
    testId,
    workType = assignmentId ? "assignment" : "test",
    onSaved,
    onDeleted,
    className,
}: ClassroomWorkEditButtonProps) {
  const t = useText();
    const { triggerUpdate } = useEventSync();
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const workLabel = workType === "assignment" ? t("assignment") : workType === "exam" ? t("exam") : t("test");
    const label = t("Edit {kind} {title}", { kind: workLabel, title });
    const deleteLabel = t("Delete {kind} {title}", { kind: workLabel, title });

    const handleSaved = async () => {
        triggerUpdate();
        await onSaved?.();
    };

    const remove = async () => {
        setDeleting(true);
        try {
            const endpoint = assignmentId
                ? `/api/classrooms/${classroomId}/assignments/${assignmentId}`
                : `/api/classrooms/${classroomId}/tests/${testId}`;
            const response = await fetch(endpoint, { method: "DELETE" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || t("Could not delete the {kind}.", { kind: workLabel }));
            setDeleteOpen(false);
            triggerUpdate();
            toast.success(t("{v0} deleted.", { v0: workType === "exam" ? t("Exam") : workType === "test" ? t("Test") : t("Assignment") }));
            await (onDeleted ?? onSaved)?.();
        } catch (error) {
            toast.error(t(error instanceof Error ? error.message : t("Could not delete the {kind}.", { kind: workLabel })));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <span className={cn("inline-flex items-center", className)}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <WorkspaceButton
                            type="button"
                            variant="ghost"
                            size="icon-compact"
                            aria-label={t("Actions for {v0} {v1}", { v0: workLabel, v1: title })}
                            title={t("More actions")}
                            onClick={(event) => event.stopPropagation()}
                            className="h-8 w-8 rounded-lg text-[var(--classroom-text-muted)]"
                        >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </WorkspaceButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        onClick={(event) => event.stopPropagation()}
                        className="classroom-dialog min-w-40 rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-1 shadow-lg"
                    >
                        <DropdownMenuItem onSelect={() => setOpen(true)} className="rounded-lg px-2.5 py-2 text-sm text-[var(--classroom-text-muted)] focus:bg-[var(--classroom-surface-muted)]">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            <span>{label}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[var(--classroom-line)]" />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)} className="rounded-lg px-2.5 py-2 text-sm focus:bg-[var(--app-danger-soft)]">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            <span>{t(deleteLabel)}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </span>
            {open && (
                <ClassroomWorkEditModal
                    open
                    event={{ classroomId, assignmentId, testId }}
                    onClose={() => setOpen(false)}
                    onSaved={handleSaved}
                />
            )}
            <DeleteConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={remove}
                isDeleting={deleting}
                title={t("Delete {v0}?", { v0: workLabel })}
                description={t("Delete “{v0}” and all of its submissions and grades? This action cannot be undone.", { v0: title })}
            />
        </>
    );
}
