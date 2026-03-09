"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Editor } from "@/components/ui/editor";
import { Image as ImageIcon, Upload, X, Paperclip } from "lucide-react";

interface CreateCourseModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (course: any) => void;
}

export function CreateCourseModal({ open, onClose, onCreated }: CreateCourseModalProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [uploadingCover, setUploadingCover] = useState(false);

    // Support file attachments
    const [files, setFiles] = useState<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);

    const [saving, setSaving] = useState(false);

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingCover(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload/local", { method: "POST", body: formData });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setCoverImageUrl(data.fileUrl);
        } catch {
            toast.error("Failed to upload cover image.");
        } finally {
            setUploadingCover(false);
            e.target.value = "";
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList?.length) return;
        setUploadingFiles(true);
        try {
            for (const file of Array.from(fileList)) {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload/local", { method: "POST", body: formData });
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
            setUploadingFiles(false);
            e.target.value = "";
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Please enter a course title.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    coverImageUrl: coverImageUrl || null,
                    files: files
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Failed to create course.");
                return;
            }
            const course = await res.json();

            const enrichedCourse = {
                ...course,
                _count: { modules: 0, enrollments: 0 },
                creator: { name: "You" } // Simplified for local update
            };

            toast.success("Course created!");
            onCreated(enrichedCourse);
            setTitle("");
            setDescription("");
            setCoverImageUrl("");
            setFiles([]);
            onClose();
        } catch {
            toast.error("Failed to create course.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="p-0 max-w-4xl max-h-[90vh] overflow-hidden border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none flex flex-col">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col h-full overflow-y-auto">
                    <DialogHeader className="shrink-0 pb-2">
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Create Course
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 flex-1 py-4">
                        {/* Title and Cover Image Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                    Course Title *
                                </label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm md:text-lg font-bold border-0 outline-none ring-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 md:h-12 w-full"
                                    placeholder="e.g. Introduction to React"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                    Banner Photo
                                </label>
                                <div className="relative group">
                                    <div className="bg-(--theme-sidebar) rounded-xl corner-squircle h-10 md:h-12 w-full flex items-center justify-center overflow-hidden border-2 border-dashed border-(--theme-text)/20 transition-colors group-hover:border-(--theme-text)/50">
                                        {coverImageUrl ? (
                                            <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-bold text-(--theme-text) opacity-50 flex items-center">
                                                <ImageIcon className="w-4 h-4 mr-2" />
                                                {uploadingCover ? "Uploading..." : "Upload Cover"}
                                            </span>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleCoverUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            disabled={uploadingCover}
                                        />
                                    </div>
                                    {coverImageUrl && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); setCoverImageUrl(""); }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 z-10"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Rich Text Description */}
                        <div>
                            <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase mb-1">
                                Course Description
                            </label>
                            <div className="bg-(--theme-sidebar) rounded-xl corner-squircle border border-(--theme-text)/10 p-4 min-h-[300px]">
                                <Editor
                                    initialValue={description}
                                    onChange={(val) => setDescription(val)}
                                    placeholder="Write your course description here. You can add images, formats, and lists..."
                                    className="min-h-[250px]"
                                />
                            </div>
                        </div>

                        {/* File Attachments */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs md:text-base font-bold text-(--theme-text) uppercase">
                                    Course Materials
                                </label>
                                <label className="flex items-center gap-2 bg-(--theme-sidebar) px-3 py-1.5 rounded-lg text-xs font-bold text-(--theme-text) cursor-pointer hover:opacity-80 transition-opacity">
                                    <Upload className="h-3 w-3 opacity-50" />
                                    {uploadingFiles ? "Uploading..." : "Attach Files"}
                                    <input type="file" multiple onChange={handleFileUpload} className="hidden" disabled={uploadingFiles} />
                                </label>
                            </div>

                            {files.length === 0 ? (
                                <div className="bg-(--theme-sidebar)/50 rounded-xl corner-squircle border border-dashed border-(--theme-text)/10 p-6 flex flex-col items-center justify-center text-center">
                                    <Paperclip className="h-8 w-8 text-(--theme-text) opacity-20 mb-2" />
                                    <p className="text-sm font-bold text-(--theme-text) opacity-50">No files attached yet.</p>
                                    <p className="text-xs text-(--theme-text) opacity-40">Add PDFs, images, or documents for your course.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-(--theme-sidebar) px-3 py-2.5 rounded-xl corner-squircle text-sm font-bold text-(--theme-text)">
                                            <div className="bg-(--theme-card) p-2 rounded-lg">
                                                <Paperclip className="h-4 w-4 opacity-50" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="block truncate max-w-[150px]">{f.fileName}</span>
                                                <span className="block text-[10px] opacity-50 uppercase">{(f.fileSize / 1024).toFixed(1)} KB</span>
                                            </div>
                                            <button
                                                onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                                                className="opacity-50 hover:opacity-100 p-1 hover:bg-black/10 rounded-max transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 shrink-0 mt-auto border-t border-(--theme-text)/10">
                        <FancyButton
                            onClick={onClose}
                            className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase"
                        >
                            Cancel
                        </FancyButton>
                        <FancyButton
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase bg-(--theme-text) text-(--theme-bg) hover:opacity-90 transition-opacity !border-none"
                        >
                            {saving ? "Creating…" : "Create"}
                        </FancyButton>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
