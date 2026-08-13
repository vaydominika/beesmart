"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

interface CreateClassroomModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (classroom: any) => void;
}

export function CreateClassroomModal({ open, onClose, onCreated }: CreateClassroomModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [subject, setSubject] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Please enter a classroom name.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/classrooms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    subject: subject.trim() || null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Failed to create classroom.");
                return;
            }
            const classroom = await res.json();
            toast.success("Classroom created!");
            onCreated(classroom);
            setName("");
            setDescription("");
            setSubject("");
            onClose();
        } catch {
            toast.error("Failed to create classroom.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="classroom-dialog max-w-lg overflow-hidden rounded-2xl border border-[var(--classroom-line-strong)] bg-white p-0 shadow-2xl">
                <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-white p-5 shadow-none md:p-8">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Create Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 flex-1">
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Name *
                            </label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                placeholder="e.g. Math 101"
                            />
                        </div>
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Subject
                            </label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                placeholder="e.g. Mathematics"
                            />
                        </div>
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Description
                            </label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-5 shrink-0">
                        <WorkspaceButton
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton
                            type="button"
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1"
                        >
                            {saving ? "Creating…" : "Create"}
                        </WorkspaceButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
