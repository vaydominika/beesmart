"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type CourseSource = "all" | "my";

export interface PostCourse {
    id: string;
    title: string;
    description?: string | null;
    visibility: string;
    coverImageUrl?: string | null;
    creator: { name: string };
    _count?: { modules: number };
}

interface CoursePostModalProps {
    open: boolean;
    selectedCourseId?: string;
    onClose: () => void;
    onSelect: (course: PostCourse) => void;
}

export function CoursePostModal({ open, selectedCourseId, onClose, onSelect }: CoursePostModalProps) {
    const [source, setSource] = useState<CourseSource>("all");
    const [search, setSearch] = useState("");
    const [courses, setCourses] = useState<PostCourse[]>([]);
    const [courseId, setCourseId] = useState(selectedCourseId ?? "");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) setCourseId(selectedCourseId ?? "");
    }, [open, selectedCourseId]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ source });
                if (search.trim()) params.set("search", search.trim());
                const response = await fetch(`/api/courses?${params}`);
                if (!response.ok) throw new Error("Could not load courses");
                const data = await response.json();
                if (!cancelled) setCourses(data);
            } catch {
                if (!cancelled) {
                    setCourses([]);
                    toast.error("Could not load courses.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [open, search, source]);

    const selectedCourse = courses.find((course) => course.id === courseId);

    const handleAdd = () => {
        if (!selectedCourse) return;
        onSelect(selectedCourse);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
            <DialogContent className="p-0 max-w-2xl max-h-[90vh] overflow-hidden border-dashed border-4 border-(--theme-text-important) corner-squircle rounded-2xl bg-transparent shadow-none">
                <FancyCard className="bg-(--theme-bg) p-4 md:p-8">
                    <DialogHeader>
                        <DialogTitle className="text-lg md:text-[32px] font-bold text-(--theme-text) uppercase">
                            Add a course
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-1 bg-(--theme-sidebar) p-1 rounded-xl">
                            {(["all", "my"] as CourseSource[]).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => { setSource(tab); setCourseId(""); }}
                                    className={cn(
                                        "py-2.5 rounded-lg text-xs font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--theme-text-important)",
                                        source === tab ? "bg-(--theme-card)" : "opacity-45 hover:opacity-80",
                                    )}
                                >
                                    {tab === "all" ? "All courses" : "My courses"}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-35" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search courses"
                                aria-label="Search courses"
                                className="pl-10 h-11 bg-(--theme-sidebar) border-0 rounded-xl"
                            />
                        </div>

                        <div className="h-64 overflow-y-auto space-y-2 pr-1" aria-live="polite">
                            {loading ? (
                                <div className="h-full flex items-center justify-center"><Spinner /></div>
                            ) : courses.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-xs font-bold uppercase text-(--theme-text) opacity-35">
                                    No matching courses
                                </div>
                            ) : courses.map((course) => {
                                const isPrivate = course.visibility === "PRIVATE";
                                return (
                                    <button
                                        key={course.id}
                                        type="button"
                                        onClick={() => setCourseId(course.id)}
                                        disabled={isPrivate}
                                        title={isPrivate ? "Change this course to Public or Invitation-only before sharing it" : undefined}
                                        className={cn(
                                            "w-full flex gap-3 items-center text-left p-3 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--theme-text-important)",
                                            courseId === course.id
                                                ? "bg-(--theme-card) ring-2 ring-(--theme-text-important)/20"
                                                : "bg-(--theme-sidebar) hover:-translate-y-0.5",
                                            isPrivate && "opacity-35 cursor-not-allowed hover:translate-y-0",
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-(--theme-bg) flex items-center justify-center shrink-0">
                                            <BookOpen className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-(--theme-text) truncate">{course.title}</p>
                                            <p className="text-[10px] text-(--theme-text) opacity-45 uppercase truncate">
                                                {course.creator.name} · {course._count?.modules ?? 0} modules · {course.visibility.replace("_", " ")}
                                            </p>
                                        </div>
                                        {courseId === course.id && <Check className="h-4 w-4 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <FancyButton onClick={onClose} className="flex-1 text-(--theme-text) text-xs md:text-lg font-bold uppercase">
                                Cancel
                            </FancyButton>
                            <FancyButton
                                onClick={handleAdd}
                                disabled={!selectedCourse}
                                className="flex-1 text-(--theme-text) text-xs md:text-lg font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Add course
                            </FancyButton>
                        </div>
                    </div>
                </FancyCard>
            </DialogContent>
        </Dialog>
    );
}
