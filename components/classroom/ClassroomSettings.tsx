"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Trash2 } from "lucide-react";
import { DeleteConfirmationModal } from "@/components/calendar/DeleteConfirmationModal";

interface Props {
    classroom: {
        id: string;
        name: string;
        description?: string | null;
        code: string;
        subject?: string | null;
    };
    onUpdated: () => void;
    onDeleted: () => void;
}

export function ClassroomSettings({ classroom, onUpdated, onDeleted }: Props) {
    const [name, setName] = useState(classroom.name);
    const [description, setDescription] = useState(classroom.description || "");
    const [subject, setSubject] = useState(classroom.subject || "");
    const [saving, setSaving] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
        <div className="space-y-5 pt-1">
            {/* Class Info */}
            <section className="rounded-xl border border-[#ecece6] bg-[#fcfcfa] p-4 md:p-5">
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-[#20231f]">Classroom details</h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#595d57]">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-10 w-full rounded-xl border-[#e6e6e0] bg-[#f7f7f4] text-sm font-normal focus-visible:border-[#c4a72f] focus-visible:ring-[#f3c941]/20"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#595d57]">Subject</label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="h-10 w-full rounded-xl border-[#e6e6e0] bg-[#f7f7f4] text-sm font-normal focus-visible:border-[#c4a72f] focus-visible:ring-[#f3c941]/20"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#595d57]">Description</label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-10 w-full rounded-xl border-[#e6e6e0] bg-[#f7f7f4] text-sm font-normal focus-visible:border-[#c4a72f] focus-visible:ring-[#f3c941]/20"
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="mt-2 rounded-xl border border-[#e8dda0] bg-(--classroom-accent) px-4 py-2.5 text-sm font-semibold text-[#20231f] transition-colors hover:bg-(--classroom-accent-hover) disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="rounded-xl border border-red-100 bg-red-50/30 p-4 md:p-5">
                <h2 className="text-base font-semibold text-red-700">Delete classroom</h2>
                <p className="mb-4 mt-1 text-sm leading-5 text-[#747771]">
                    Deleting this classroom will permanently remove all posts, assignments, tests, and grades.
                </p>
                <button
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Classroom
                </button>
            </section>

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
