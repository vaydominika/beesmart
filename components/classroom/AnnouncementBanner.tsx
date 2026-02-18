"use client";

import { useState, useEffect, useCallback } from "react";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, AlertCircle, Megaphone, Pin, X } from "lucide-react";

interface Announcement {
    id: string;
    title: string;
    body: string;
    priority: "INFO" | "IMPORTANT" | "WARNING" | "URGENT";
    isPinned: boolean;
    createdAt: string;
    author: { id: string; name: string; avatar?: string | null };
}

const PRIORITY_STYLES: Record<string, { bg: string; icon: React.ReactNode; border: string }> = {
    INFO: {
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        icon: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
    },
    IMPORTANT: {
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        icon: <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />,
    },
    WARNING: {
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
        icon: <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />,
    },
    URGENT: {
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        icon: <Megaphone className="h-4 w-4 text-red-500 shrink-0" />,
    },
};

interface Props {
    classroomId: string;
    isTeacher: boolean;
}

export function AnnouncementBanner({ classroomId, isTeacher }: Props) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [createOpen, setCreateOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [priority, setPriority] = useState<Announcement["priority"]>("INFO");
    const [saving, setSaving] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/announcements`);
            if (!res.ok) return;
            setAnnouncements(await res.json());
        } catch {
            // ignore
        }
    }, [classroomId]);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    const handleCreate = async () => {
        if (!title.trim() || !body.trim()) {
            toast.error("Title and body required.");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/classrooms/${classroomId}/announcements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, body, priority }),
            });
            if (!res.ok) {
                toast.error("Failed to create announcement.");
                return;
            }
            toast.success("Announcement posted!");
            setTitle("");
            setBody("");
            setPriority("INFO");
            setCreateOpen(false);
            fetchAnnouncements();
        } catch {
            toast.error("Failed to create announcement.");
        } finally {
            setSaving(false);
        }
    };

    const visible = announcements.filter((a) => !dismissed.has(a.id));
    if (visible.length === 0 && !isTeacher) return null;

    return (
        <div className="mb-6 space-y-2">
            {visible.map((a) => {
                const style = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.INFO;
                return (
                    <div
                        key={a.id}
                        className={cn(
                            "flex items-start gap-3 p-3 rounded-xl corner-squircle border",
                            style.bg,
                            style.border
                        )}
                    >
                        {style.icon}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-(--theme-text) truncate">{a.title}</span>
                                {a.isPinned && <Pin className="h-3 w-3 text-(--theme-text) opacity-50" />}
                            </div>
                            <p className="text-xs text-(--theme-text) opacity-70 mt-0.5 line-clamp-2">{a.body}</p>
                        </div>
                        <button
                            onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
                            className="shrink-0 p-1 rounded-md hover:bg-(--theme-card)/30 text-(--theme-text) opacity-50 hover:opacity-100"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                );
            })}

            {isTeacher && (
                <FancyButton
                    onClick={() => setCreateOpen(true)}
                    className="text-(--theme-text) text-xs font-bold uppercase px-3 py-1"
                >
                    <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                    New Announcement
                </FancyButton>
            )}

            {/* Create Announcement Modal */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="p-0 max-w-lg border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                    <FancyCard className="bg-(--theme-bg) p-4 md:p-8 flex flex-col">
                        <DialogHeader className="shrink-0 pb-2">
                            <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                                New Announcement
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Title</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 focus-visible:ring-2 focus-visible:ring-(--theme-card) h-10 w-full"
                                    placeholder="Announcement title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Body</label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="bg-(--theme-sidebar) rounded-xl corner-squircle text-sm font-bold border-0 outline-none ring-0 focus:ring-2 focus:ring-(--theme-card) min-h-[80px] w-full p-3 resize-none"
                                    placeholder="Write your announcement..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-(--theme-text) uppercase mb-1">Priority</label>
                                <div className="flex gap-2">
                                    {(["INFO", "IMPORTANT", "WARNING", "URGENT"] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPriority(p)}
                                            className={cn(
                                                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                                                priority === p
                                                    ? PRIORITY_STYLES[p].bg + " border " + PRIORITY_STYLES[p].border
                                                    : "bg-(--theme-sidebar) opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-5">
                            <FancyButton onClick={() => setCreateOpen(false)} className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase">
                                Cancel
                            </FancyButton>
                            <FancyButton onClick={handleCreate} disabled={saving} className="flex-1 text-(--theme-text) text-xs md:text-xl font-bold uppercase">
                                {saving ? "Posting…" : "Post"}
                            </FancyButton>
                        </div>
                    </FancyCard>
                </DialogContent>
            </Dialog>
        </div>
    );
}
