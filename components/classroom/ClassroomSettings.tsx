"use client";

import { useState } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { Trash2 } from "lucide-react";
import { DeleteConfirmationModal } from "@/components/calendar/DeleteConfirmationModal";

const COLORS = ["#FEC435", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#DDA0DD", "#FFEEAD", "#98D8C8"];

interface Props {
    classroom: {
        id: string;
        name: string;
        description?: string | null;
        code: string;
        color?: string | null;
        subject?: string | null;
    };
    onUpdated: () => void;
    onDeleted: () => void;
}

export function ClassroomSettings({ classroom, onUpdated, onDeleted }: Props) {
    const [name, setName] = useState(classroom.name);
    const [description, setDescription] = useState(classroom.description || "");
    const [subject, setSubject] = useState(classroom.subject || "");
    const [color, setColor] = useState(classroom.color || COLORS[0]);
    const [saving, setSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/classroom/join?code=${classroom.code}` : "";

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Name is required.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/classrooms/${classroom.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    subject: subject.trim() || null,
                    color,
                }),
            });
            if (!res.ok) {
                toast.error("Failed to update.");
                return;
            }
            toast.success("Classroom updated!");
            onUpdated();
        } catch {
            toast.error("Failed to update.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/classrooms/${classroom.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to delete.");
                return;
            }
            toast.success("Classroom deleted.");
            onDeleted();
        } catch {
            toast.error("Failed to delete.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Class Info */}
            <FancyCard className="bg-(--theme-card) p-4 md:p-6">
                <h3 className="text-sm font-bold text-(--theme-text) uppercase mb-4">Classroom Details</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Subject</label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Description</label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Color</label>
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
                                />
                            ))}
                        </div>
                    </div>
                    <FancyButton
                        onClick={handleSave}
                        disabled={saving}
                        className="text-(--theme-text) text-xs md:text-base font-bold uppercase px-4 py-1.5 mt-2"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </FancyButton>
                </div>
            </FancyCard>

            {/* QR Code */}
            <FancyCard className="bg-(--theme-card) p-4 md:p-6">
                <h3 className="text-sm font-bold text-(--theme-text) uppercase mb-4">Invite Link & QR</h3>
                <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-xl mb-3">
                        {joinUrl && <QRCodeSVG value={joinUrl} size={200} level="M" />}
                    </div>
                    <p className="text-sm font-bold text-(--theme-text) tracking-[0.2em]">{classroom.code}</p>
                    <p className="text-xs text-(--theme-text) opacity-40 mt-1">Scan or share the code above</p>
                </div>
            </FancyCard>

            {/* Danger Zone */}
            <FancyCard className="bg-(--theme-card) p-4 md:p-6 border border-red-500/20">
                <h3 className="text-sm font-bold text-red-500 uppercase mb-2">Danger Zone</h3>
                <p className="text-xs text-(--theme-text) opacity-50 mb-3">
                    Deleting this classroom will permanently remove all posts, assignments, tests, and grades.
                </p>
                <FancyButton
                    onClick={() => setDeleteOpen(true)}
                    className="bg-red-500/10 text-red-500 text-xs font-bold uppercase px-4 py-1.5"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Classroom
                </FancyButton>
            </FancyCard>

            <DeleteConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                isDeleting={deleting}
                title="Delete Classroom"
                description="Are you sure? This will permanently delete all posts, assignments, tests, and grades. This action cannot be undone."
            />
        </div>
    );
}
