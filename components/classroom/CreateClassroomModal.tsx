"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#FEC435", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#DDA0DD", "#FFEEAD", "#98D8C8"];

interface CreateClassroomModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (classroom: any) => void;
}

export function CreateClassroomModal({ open, onClose, onCreated }: CreateClassroomModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [subject, setSubject] = useState("");
    const [color, setColor] = useState(COLORS[0]);
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
                    color,
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
            setColor(COLORS[0]);
            onClose();
        } catch {
            toast.error("Failed to create classroom.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
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
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Color
                            </label>
                            <div className="flex gap-2">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                                            color === c ? "border-(--theme-text) scale-110" : "border-transparent"
                                        )}
                                        style={{ backgroundColor: c }}
                                        type="button"
                                        aria-label={`Select color ${c}`}
                                    />
                                ))}
                            </div>
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
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase"
                        >
                            {saving ? "Creating…" : "Create"}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
