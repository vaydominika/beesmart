"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Search, X } from "lucide-react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
            <DialogContent className="classroom-dialog max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl gap-0 overflow-hidden rounded-2xl border border-[#deded7] bg-white p-0 shadow-2xl">
                <DialogClose
                    aria-label="Close course picker"
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-[#777a73] transition-colors hover:bg-[#f2f2ee] hover:text-[#20231f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]"
                >
                    <X className="h-4 w-4" />
                </DialogClose>

                <div className="flex min-h-0 flex-col p-4 md:p-5">
                    <DialogHeader className="shrink-0 border-b border-[#ecece6] pb-4 pr-10 text-left">
                        <DialogTitle className="text-xl font-semibold text-(--theme-text)">
                            Add a course
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Choose a course to attach to the post.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative mt-3 grid shrink-0 grid-cols-2 border-b border-[#e8e8e2]" role="tablist" aria-label="Course source">
                        <span
                            aria-hidden="true"
                            className={cn(
                                "absolute bottom-[-1px] left-0 h-0.5 w-1/2 bg-(--classroom-accent) transition-transform duration-200 motion-reduce:transition-none",
                                source === "my" && "translate-x-full",
                            )}
                        />
                        {(["all", "my"] as CourseSource[]).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={source === tab}
                                onClick={() => {
                                    setSource(tab);
                                    setCourseId("");
                                }}
                                className={cn(
                                    "h-10 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d2bc4a]",
                                    source === tab ? "font-semibold text-[#20231f]" : "font-medium text-[#858880] hover:text-[#4d504a]",
                                )}
                            >
                                {tab === "all" ? "All courses" : "My courses"}
                            </button>
                        ))}
                    </div>

                    <div className="relative my-3 shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f928b]" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search courses"
                            aria-label="Search courses"
                            className="h-10 rounded-xl border border-[#e4e4de] bg-[#fafaf8] pl-10 pr-3 text-sm font-normal shadow-none focus-visible:border-[#d2bc4a] focus-visible:ring-2 focus-visible:ring-[#f2e7a9]"
                        />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1" aria-live="polite">
                        {loading ? (
                            <div className="flex h-52 items-center justify-center">
                                <Spinner />
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-[#deded7] text-center">
                                <BookOpen className="mb-2 h-5 w-5 text-[#999c95]" />
                                <p className="text-sm font-medium text-[#4d504a]">No matching courses</p>
                            </div>
                        ) : (
                            <div className="space-y-2 pb-1">
                                {courses.map((course) => {
                                    const isPrivate = course.visibility === "PRIVATE";
                                    const isSelected = courseId === course.id;

                                    return (
                                        <button
                                            key={course.id}
                                            type="button"
                                            onClick={() => setCourseId((currentId) => currentId === course.id ? "" : course.id)}
                                            aria-pressed={isSelected}
                                            disabled={isPrivate}
                                            title={isPrivate ? "Change this course to public or invitation-only before sharing it" : undefined}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]",
                                                isSelected
                                                    ? "border-[#e2cf68] bg-[#fff9d8]"
                                                    : "border-[#e4e4de] bg-white hover:border-[#d8d8d1] hover:bg-[#fafaf8]",
                                                isPrivate && "cursor-not-allowed opacity-45",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                                    isSelected
                                                        ? "border-[#eadb8b] bg-white"
                                                        : "border-[#ecece6] bg-[#fafaf8]",
                                                )}
                                            >
                                                <BookOpen className="h-4 w-4 text-[#5f625c]" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-[#20231f]">{course.title}</span>
                                                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#858880]">
                                                    <span className="truncate">{course.creator.name}</span>
                                                    <span>{course._count?.modules ?? 0} modules</span>
                                                    <span className="rounded-md bg-[#f1f1ed] px-1.5 py-0.5 text-[10px] font-medium capitalize text-[#666962]">
                                                        {course.visibility.replaceAll("_", " ").toLowerCase()}
                                                    </span>
                                                </span>
                                            </span>
                                            {isSelected && (
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--classroom-accent) text-[#20231f]">
                                                    <Check className="h-3.5 w-3.5" />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[#ecece6] pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 rounded-xl border border-[#e4e4de] bg-white px-4 text-sm font-medium text-[#4d504a] transition-colors hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!selectedCourse}
                            className="h-9 rounded-xl border border-[#e8dda0] bg-(--classroom-accent) px-4 text-sm font-semibold text-[#20231f] transition-colors hover:bg-(--classroom-accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d2bc4a] disabled:cursor-not-allowed disabled:border-[#ecece6] disabled:bg-[#f5f5f1] disabled:text-[#a6a8a2]"
                        >
                            Add course
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
