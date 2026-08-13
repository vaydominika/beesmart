"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Paperclip, Upload, X } from "lucide-react";
import type { AssignmentDraft, PostAttachmentFile } from "@/lib/classroom-post-drafts";

type UploadedFile = PostAttachmentFile;

interface Props {
    open: boolean;
    onClose: () => void;
    onAdd: (assignment: AssignmentDraft) => void;
}

export function CreateAssignmentModal({ open, onClose, onAdd }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [timeZone, setTimeZone] = useState("UTC");
    const [isGraded, setIsGraded] = useState(true);
    const [maxPoints, setMaxPoints] = useState("100");
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        setUploading(true);
        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("purpose", "POST_ATTACHMENT");
                const res = await fetch("/api/uploads", {
                    method: "POST",
                    body: formData,
                });
                if (!res.ok) {
                    toast.error(`Failed to upload ${file.name}`);
                    continue;
                }
                const uploaded = await res.json();
                setFiles((prev) => [...prev, uploaded]);
            }
        } catch {
            toast.error("Upload failed.");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (!title.trim()) {
            toast.error("Please enter a title.");
            return;
        }
        if (!dueDate) {
            toast.error("Please set a due date.");
            return;
        }
        onAdd({
            title: title.trim(),
            description: description.trim() || null,
            dueDate,
            dueTime: dueTime || null,
            timeZone,
            isGraded,
            maxPoints: isGraded ? maxPoints : null,
            files,
        });
        toast.success("Assignment added to post.");
        setTitle("");
        setDescription("");
        setDueDate("");
        setDueTime("");
        setIsGraded(true);
        setMaxPoints("100");
        setFiles([]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="classroom-dialog max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl gap-0 overflow-hidden rounded-2xl border border-[var(--classroom-line-strong)] bg-[var(--app-surface)] p-0 shadow-2xl">
                <DialogClose
                    aria-label="Close assignment builder"
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                >
                    <X className="h-4 w-4" />
                </DialogClose>

                <div className="flex min-h-0 flex-col p-4 md:p-5">
                    <DialogHeader className="shrink-0 border-b border-[var(--classroom-line)] pb-4 pr-10 text-left">
                        <DialogTitle className="text-xl font-semibold text-(--theme-text)">
                            Create assignment
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Add assignment details and attach it to the post.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="min-h-0 max-h-[calc(100dvh-11rem)] flex-1">
                        <div className="space-y-4 py-4 pl-1 pr-3">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Title *</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 text-sm font-normal shadow-none focus-visible:border-[var(--classroom-focus-border)] focus-visible:ring-2 focus-visible:ring-(--theme-card)"
                                    placeholder="e.g. Chapter 5 homework"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="min-h-24 w-full resize-none rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] p-3 text-sm font-normal text-(--theme-text) outline-none transition-shadow placeholder:text-[var(--classroom-text-faint)] focus:border-[var(--classroom-focus-border)] focus:ring-2 focus:ring-(--theme-card)"
                                    placeholder="Add instructions..."
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Due date *</label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="h-10 w-full cursor-pointer rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 text-sm font-normal shadow-none focus-visible:border-[var(--classroom-focus-border)] focus-visible:ring-2 focus-visible:ring-(--theme-card)"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Due time</label>
                                    <Input
                                        type="time"
                                        value={dueTime}
                                        onChange={(e) => setDueTime(e.target.value)}
                                        className="h-10 w-full cursor-pointer rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 text-sm font-normal shadow-none focus-visible:border-[var(--classroom-focus-border)] focus-visible:ring-2 focus-visible:ring-(--theme-card)"
                                    />
                                </div>
                            </div>
                            <p className="-mt-2 text-xs text-[var(--classroom-text-faint)]">
                                Deadline timezone: {timeZone}. A date without a time is due at 23:59.
                            </p>

                            <div className="grid items-end gap-3 sm:grid-cols-[1fr_9rem]">
                                <div>
                                    <span className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Grading</span>
                                    <div className="flex h-10 items-center justify-between rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3">
                                        <label htmlFor="assignment-graded" className="text-sm text-(--theme-text)">Graded</label>
                                        <Switch
                                            id="assignment-graded"
                                            checked={isGraded}
                                            onCheckedChange={setIsGraded}
                                            className="data-[state=checked]:bg-(--classroom-accent)"
                                        />
                                    </div>
                                </div>

                                {isGraded && (
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Max points</label>
                                        <Input
                                            type="number"
                                            value={maxPoints}
                                            onChange={(e) => setMaxPoints(e.target.value)}
                                            className="h-10 w-full rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 text-sm font-normal shadow-none focus-visible:border-[var(--classroom-focus-border)] focus-visible:ring-2 focus-visible:ring-(--theme-card)"
                                            min="0"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <span className="mb-1.5 block text-xs font-medium text-[var(--classroom-text-muted)]">Attachments</span>
                                {files.length > 0 && (
                                    <div className="mb-2 space-y-2">
                                        {files.map((file, index) => (
                                            <div
                                                key={`${file.fileName}-${index}`}
                                                className="flex items-center gap-2 rounded-xl border border-[var(--classroom-line)] bg-[var(--classroom-surface-muted)] px-3 py-2 text-sm text-(--theme-text)"
                                            >
                                                <Paperclip className="h-4 w-4 shrink-0 text-[var(--classroom-text-muted)]" />
                                                <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    aria-label={`Remove ${file.fileName}`}
                                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-hover)] hover:text-[var(--classroom-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--classroom-focus-border)]"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--classroom-line)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--classroom-text-muted)] transition-colors hover:bg-[var(--classroom-surface-muted)] focus-within:ring-2 focus-within:ring-[var(--classroom-focus-border)]">
                                    <Upload className="h-4 w-4" />
                                    {uploading ? "Uploading..." : "Add files"}
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[var(--classroom-line)] pt-3">
                        <WorkspaceButton type="button" variant="secondary" onClick={onClose}>
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" onClick={handleSave} disabled={uploading}>
                            Add assignment
                        </WorkspaceButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
