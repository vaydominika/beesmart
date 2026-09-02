"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Search, X } from "lucide-react";
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceDialogContent } from "@/components/ui/workspace-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
            <WorkspaceDialogContent mobileSheet={false} className="classroom-dialog h-[min(35rem,calc(100dvh-1.5rem))] w-[calc(100%-1.5rem)] max-w-xl gap-0 overflow-hidden rounded-2xl border border-(--classroom-line-strong) bg-(--classroom-surface) p-0 shadow-2xl">
                <DialogClose
                    aria-label="Close course picker"
                    className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-(--classroom-text-muted) transition-colors hover:bg-(--classroom-surface-muted) hover:text-(--classroom-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--classroom-focus-ring)"
                >
                    <X className="h-4 w-4" />
                </DialogClose>

                <div className="flex h-full min-h-0 flex-col p-4 md:p-5">
                    <DialogHeader className="shrink-0 border-b border-(--classroom-line) pb-4 pr-10 text-left">
                        <DialogTitle className="text-xl font-semibold text-(--theme-text)">
                            Add a course
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Choose a course to attach to the post.
                        </DialogDescription>
                    </DialogHeader>

                    <WorkspaceTabs
                        ariaLabel="Course source"
                        value={source}
                        onValueChange={(tab) => {
                            setSource(tab);
                            setCourseId("");
                        }}
                        items={[{ value: "all", label: "All courses" }, { value: "my", label: "My courses" }] satisfies Array<{ value: CourseSource; label: string }>}
                        size="compact"
                        fill
                        className="mt-3 shrink-0"
                    />

                    <div className="relative my-3 shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--classroom-text-muted)" />
                        <Input
                            type="search"
                            name="classroom-course-query"
                            autoComplete="off"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search courses"
                            aria-label="Search courses"
                            className="h-10 rounded-xl pl-10 pr-3 text-sm font-normal shadow-none"
                        />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1" aria-live="polite">
                        {loading ? (
                            <div className="flex h-full items-center justify-center">
                                <Spinner />
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-(--classroom-line-strong) text-center">
                                <p className="text-sm font-medium text-(--classroom-text-muted)">No matching courses</p>
                            </div>
                        ) : (
                            <div className="space-y-2 pb-1">
                                {courses.map((course) => {
                                    const isPrivate = course.visibility === "PRIVATE";
                                    const isSelected = courseId === course.id;

                                    const courseOption = (
                                        <button
                                            key={course.id}
                                            type="button"
                                            onClick={() => setCourseId((currentId) => currentId === course.id ? "" : course.id)}
                                            aria-pressed={isSelected}
                                            disabled={isPrivate}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--classroom-focus-ring)",
                                                isSelected
                                                    ? "border-(--classroom-accent-hover) bg-(--classroom-accent)"
                                                    : "border-(--classroom-line) bg-(--classroom-surface) hover:border-(--classroom-line-strong) hover:bg-(--classroom-surface-hover)",
                                                isPrivate && "cursor-not-allowed opacity-45",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                                    isSelected
                                                        ? "border-(--classroom-accent-hover) bg-(--classroom-surface)"
                                                        : "border-(--classroom-line) bg-(--classroom-surface-muted)",
                                                )}
                                            >
                                                <BookOpen className="h-4 w-4 text-(--classroom-text-muted)" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-(--classroom-text)">{course.title}</span>
                                                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-(--classroom-text-muted)">
                                                    <span className="truncate">{course.creator.name}</span>
                                                    <span>{course._count?.modules ?? 0} modules</span>
                                                    <span className="rounded-md bg-(--classroom-surface-muted) px-1.5 py-0.5 text-[10px] font-medium capitalize text-(--classroom-text-muted)">
                                                        {course.visibility.replaceAll("_", " ").toLowerCase()}
                                                    </span>
                                                </span>
                                            </span>
                                            {isSelected && (
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--app-accent) text-(--classroom-text)">
                                                    <Check className="h-3.5 w-3.5" />
                                                </span>
                                            )}
                                        </button>
                                    );

                                    return isPrivate ? (
                                        <Tooltip key={course.id}>
                                            <TooltipTrigger asChild><span className="block">{courseOption}</span></TooltipTrigger>
                                            <TooltipContent>Change this course to public or invitation-only before sharing it</TooltipContent>
                                        </Tooltip>
                                    ) : courseOption;
                                })}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-(--classroom-line) pt-3">
                        <WorkspaceButton type="button" variant="secondary" onClick={onClose}>
                            Cancel
                        </WorkspaceButton>
                        <WorkspaceButton type="button" variant="primary" onClick={handleAdd} disabled={!selectedCourse}>
                            Add course
                        </WorkspaceButton>
                    </div>
                </div>
            </WorkspaceDialogContent>
        </Dialog>
    );
}
