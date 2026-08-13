"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

interface JoinClassroomModalProps {
    open: boolean;
    onClose: () => void;
    onJoined: (classroom: any) => void;
}

export function JoinClassroomModal({ open, onClose, onJoined }: JoinClassroomModalProps) {
    const [code, setCode] = useState("");
    const [joining, setJoining] = useState(false);

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
                const data = await res.json().catch(() => ({}));
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
            <DialogContent className="classroom-dialog max-w-md overflow-hidden rounded-2xl border border-[var(--classroom-line-strong)] bg-white p-0 shadow-2xl">
                <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--classroom-line)] bg-white p-5 shadow-none md:p-8">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Join Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 flex-1">
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Classroom Code
                            </label>
                            <Input
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
            </DialogContent>
        </Dialog>
    );
}
