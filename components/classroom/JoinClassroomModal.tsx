"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
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
            <DialogContent className="p-0 max-w-md border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Join Classroom
                        </DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-(--theme-text) opacity-60 mb-4">
                        Enter the classroom code given by your teacher to join.
                    </p>

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
                        <FancyButton
                            onClick={onClose}
                            className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase"
                        >
                            Cancel
                        </FancyButton>
                        <FancyButton
                            onClick={handleJoin}
                            disabled={joining}
                            className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase"
                        >
                            {joining ? "Joining…" : "Join"}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
