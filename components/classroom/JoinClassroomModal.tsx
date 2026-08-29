"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { readJsonSafely } from "@/lib/http";

type ClassroomSummary = {
    id: string;
    name: string;
    description?: string | null;
    subject?: string | null;
    code: string;
    role: string;
    memberCount: number;
    creatorName?: string | null;
    createdAt: string;
    isOwner: boolean;
};

interface JoinClassroomModalProps {
    open: boolean;
    initialCode?: string;
    onClose: () => void;
    onJoined: (classroom: ClassroomSummary) => void;
}

export function JoinClassroomModal({ open, initialCode = "", onClose, onJoined }: JoinClassroomModalProps) {
    const [code, setCode] = useState("");
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (open) setCode(initialCode.trim().toUpperCase());
    }, [initialCode, open]);

    const handleJoin = async () => {
        if (!code.trim()) {
            toast.error("Please enter a classroom code.");
            return;
        }
        setJoining(true);
        try {
            const res = await fetch("/api/classrooms/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code.trim() }),
            });
            if (!res.ok) {
                const data = await readJsonSafely<{ error?: string }>(res, {});
                toast.error(data.error ?? "Failed to join classroom.");
                return;
            }
            const classroom = await res.json();
            toast.success(`Joined "${classroom.name}"!`);
            onJoined(classroom);
            setCode("");
            onClose();
        } catch {
            toast.error("Failed to join classroom.");
        } finally {
            setJoining(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog max-w-md border-[var(--classroom-line-strong)]">
                <DialogClose asChild><WorkspaceButton type="button" variant="ghost" size="icon-compact" aria-label="Close classroom join form" className="absolute right-4 top-4 z-20"><X className="h-4 w-4" /></WorkspaceButton></DialogClose>
                <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-[var(--app-surface)] p-5 shadow-none md:p-8">
                    <DialogHeader className="shrink-0 pb-2 pr-10">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Join Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 flex-1">
                        <div>
                            <label htmlFor="classroom-join-code" className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Classroom Code
                            </label>
                            <Input
                                id="classroom-join-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-lg md:text-2xl font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-12 md:h-14 w-full text-center tracking-[0.3em]"
                                placeholder="ABC123"
                                maxLength={8}
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
                            onClick={handleJoin}
                            disabled={joining}
                            className="flex-1"
                        >
                            {joining ? "Joining…" : "Join"}
                        </WorkspaceButton>
                    </div>
                </div>
            </WorkspaceDialogContent>
        </Dialog>
    );
}
