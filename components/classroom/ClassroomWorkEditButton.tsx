"use client";

import { useState } from "react";
import { Settings, Trash2 } from "lucide-react";
import { ClassroomWorkEditModal } from "@/components/calendar/ClassroomWorkEditModal";
import { DeleteConfirmationModal } from "@/components/calendar/DeleteConfirmationModal";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { toast } from "@/components/ui/sonner";
import { useEventSync } from "@/hooks/use-event-sync";
import { cn } from "@/lib/utils";

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
    const { triggerUpdate } = useEventSync();
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const label = `Edit ${workType} ${title}`;
    const deleteLabel = `Delete ${workType} ${title}`;

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
            if (!response.ok) throw new Error(data.error || `Could not delete the ${workType}.`);
            setDeleteOpen(false);
            triggerUpdate();
            toast.success(`${workType === "exam" ? "Exam" : workType === "test" ? "Test" : "Assignment"} deleted.`);
            await (onDeleted ?? onSaved)?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : `Could not delete the ${workType}.`);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <span className={cn("inline-flex items-center gap-0.5", className)}>
                <WorkspaceButton
                    type="button"
                    variant="ghost"
                    size="icon-compact"
                    aria-label={label}
                    title={`Edit ${workType}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpen(true);
                    }}
                    className="h-7 w-7 rounded-lg text-[var(--classroom-text-muted)]"
                >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                </WorkspaceButton>
                <WorkspaceButton
                    type="button"
                    variant="ghost"
                    size="icon-compact"
                    aria-label={deleteLabel}
                    title={`Delete ${workType}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        setDeleteOpen(true);
                    }}
                    className="h-7 w-7 rounded-lg text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)] hover:text-[var(--app-danger)]"
                >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </WorkspaceButton>
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
                title={`Delete ${workType}?`}
                description={`Delete “${title}” and all of its submissions and grades? This action cannot be undone.`}
            />
        </>
    );
}
