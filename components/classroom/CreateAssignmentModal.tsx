"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Paperclip, X, Upload } from "lucide-react";

interface UploadedFile {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    classroomId: string;
    onCreated: () => void;
}

export function CreateAssignmentModal({ open, onClose, classroomId, onCreated }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [isGraded, setIsGraded] = useState(true);
    const [maxPoints, setMaxPoints] = useState("100");
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;

        setUploading(true);
        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload/local", {
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

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Please enter a title.");
            return;
        }
        if (!dueDate) {
            toast.error("Please set a due date.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    dueDate,
                    dueTime: dueTime || null,
                    isGraded,
                    maxPoints: isGraded ? maxPoints : null,
                    files,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Failed to create assignment.");
                return;
            }
            toast.success("Assignment created!");
            // Reset
            setTitle("");
            setDescription("");
            setDueDate("");
            setDueTime("");
            setIsGraded(true);
            setMaxPoints("100");
            setFiles([]);
            onCreated();
            onClose();
        } catch {
            toast.error("Failed to create assignment.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-lg max-h-[95vh] overflow-hidden border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Create Assignment
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[60vh] pr-1 [&::-webkit-scrollbar]:w-[7px] [&::-webkit-scrollbar-thumb]:bg-(--theme-card) [&::-webkit-scrollbar-thumb]:rounded-full">
                        <div>
                            <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Title *</label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                placeholder="e.g. Chapter 5 Homework"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) min-h-[70px] w-full p-3 resize-none"
                                placeholder="Instructions for the assignment..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Due Date *</label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full cursor-pointer"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Due Time</label>
                                <Input
                                    type="time"
                                    value={dueTime}
                                    onChange={(e) => setDueTime(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-(--theme-text) uppercase">Graded</label>
                            <Switch
                                checked={isGraded}
                                onCheckedChange={setIsGraded}
                                className="data-[state=checked]:bg-(--theme-sidebar) scale-110"
                            />
                        </div>

                        {isGraded && (
                            <div>
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Max Points</label>
                                <Input
                                    type="number"
                                    value={maxPoints}
                                    onChange={(e) => setMaxPoints(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-32"
                                    min="0"
                                />
                            </div>
                        )}

                        {/* File Attachments */}
                        <div>
                            <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Attachments</label>
                            {files.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {files.map((f, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-1.5 bg-(--theme-sidebar) rounded-lg px-2.5 py-1.5 text-xs font-bold text-(--theme-text) opacity-70"
                                        >
                                            <Paperclip className="h-3 w-3" />
                                            <span className="truncate max-w-[120px]">{f.fileName}</span>
                                            <button onClick={() => removeFile(i)} className="hover:opacity-100 opacity-50">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <label className="inline-flex items-center gap-1.5 bg-(--theme-sidebar) rounded-lg px-3 py-2 text-xs font-bold text-(--theme-text) opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
                                <Upload className="h-3.5 w-3.5" />
                                {uploading ? "Uploading…" : "Add Files"}
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
                            {saving ? "Creating…" : "Create Assignment"}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
