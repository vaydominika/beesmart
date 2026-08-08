"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Layers01Icon,
    Tick01Icon,
    Book02Icon,
    Menu01Icon,
    PlayIcon,
    SquareLock02Icon
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { CourseRatingModal } from "@/components/course/CourseRatingModal";

interface Lesson {
    id: string;
    title: string;
    content?: string | null;
    isLocked?: boolean;
    files?: LessonFile[];
}

interface LessonFile {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    isVisible: boolean;
}

interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
}

interface CourseViewerProps {
    course: {
        id: string;
        title: string;
        modules: Module[];
    };
    initialLessonId?: string;
    initialCompletedLessonIds?: string[];
}

export default function CourseViewerClient({ course, initialLessonId, initialCompletedLessonIds = [] }: CourseViewerProps) {
    const router = useRouter();
    const allLessons = useMemo(() =>
        course.modules.flatMap((module) => module.lessons),
        [course.modules]);

    const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
        new Set(initialCompletedLessonIds)
    );

    const isLessonLocked = useCallback((lesson: Lesson) => {
        if (!lesson) return false;
        const index = allLessons.findIndex(l => l.id === lesson.id);
        if (index === -1) return false;

        // A lesson is locked if ANY previous lesson is a prerequisite (isLocked) and not completed
        for (let i = 0; i < index; i++) {
            if (allLessons[i].isLocked && !completedLessonIds.has(allLessons[i].id)) {
                return true;
            }
        }
        return false;
    }, [allLessons, completedLessonIds]);

    const initialLessonIdToUse = useMemo(() => {
        const initial = initialLessonId || allLessons[0]?.id || null;
        if (!initial) return null;

        const currentLesson = allLessons.find(l => l.id === initial);
        if (currentLesson && isLessonLocked(currentLesson)) {
            // Find the first non-locked lesson
            const firstAvailable = allLessons.find(l => !isLessonLocked(l));
            return firstAvailable?.id || allLessons[0]?.id || null;
        }
        return initial;
    }, [initialLessonId, allLessons, isLessonLocked]);

    const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonIdToUse);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
    const [ratingOpen, setRatingOpen] = useState(false);
    const [lessonContent, setLessonContent] = useState<Record<string, { content: string | null; files: LessonFile[] }>>({});
    const [contentState, setContentState] = useState<"IDLE" | "LOADING" | "LOADED" | "ERROR">("IDLE");
    const [contentRetry, setContentRetry] = useState(0);

    const activeLesson = useMemo(() => {
        const outline = allLessons.find(l => l.id === activeLessonId);
        return outline ? { ...outline, ...lessonContent[outline.id] } : undefined;
    }, [allLessons, activeLessonId, lessonContent]);

    useEffect(() => {
        if (!activeLessonId || lessonContent[activeLessonId]) return;
        const lesson = allLessons.find((item) => item.id === activeLessonId);
        if (!lesson || isLessonLocked(lesson)) {
            setContentState("IDLE");
            return;
        }
        const module = course.modules.find((item) => item.lessons.some((candidate) => candidate.id === activeLessonId));
        if (!module) return;
        const controller = new AbortController();
        setContentState("LOADING");
        fetch(`/api/courses/${course.id}/modules/${module.id}/lessons/${activeLessonId}`, { signal: controller.signal })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || "Lesson content could not be loaded");
                setLessonContent((current) => ({ ...current, [activeLessonId]: { content: data.content ?? null, files: data.files ?? [] } }));
                setContentState("LOADED");
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setContentState("ERROR");
            });
        return () => controller.abort();
    }, [activeLessonId, allLessons, contentRetry, course.id, course.modules, isLessonLocked, lessonContent]);

    const currentIndex = useMemo(() =>
        allLessons.findIndex(l => l.id === activeLessonId),
        [allLessons, activeLessonId]);

    const nextLesson = allLessons[currentIndex + 1];
    const prevLesson = allLessons[currentIndex - 1];

    const toggleComplete = async (lessonId: string, completed: boolean) => {
        try {
            setIsUpdatingProgress(true);
            const res = await fetch(`/api/courses/${course.id}/lessons/${lessonId}/progress`, {
                method: "PATCH",
                body: JSON.stringify({ completed })
            });

            if (!res.ok) throw new Error("Failed to update progress");
            const result: { newlyCompleted?: boolean } = await res.json();

            const newCompleted = new Set(completedLessonIds);
            if (completed) newCompleted.add(lessonId);
            else newCompleted.delete(lessonId);
            setCompletedLessonIds(newCompleted);

            if (result.newlyCompleted) setRatingOpen(true);

            router.refresh(); // Sync dashboard progress
        } catch (error) {
            console.error(error);
        } finally {
            setIsUpdatingProgress(false);
        }
    };

    const progressValue = useMemo(() =>
        allLessons.length > 0 ? (completedLessonIds.size / allLessons.length) * 100 : 0
        , [completedLessonIds, allLessons]);

    if (!activeLesson) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <HugeiconsIcon icon={Book02Icon} className="size-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-wider">No content found in this course.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex min-h-full bg-white relative">
            <CourseRatingModal open={ratingOpen} onOpenChange={setRatingOpen} courseId={course.id} courseTitle={course.title} />
            {/* Sidebar Syllabus */}
            <aside
                className={cn(
                    "bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 sticky top-0 h-[calc(100vh-64px)] shrink-0",
                    sidebarOpen ? "w-64" : "w-0 opacity-0 -translate-x-full overflow-hidden"
                )}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <h2 className="font-black text-slate-900 uppercase tracking-tight truncate mr-2">
                        {course.title}
                    </h2>
                    <Link href={`/courses/${course.id}`} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {course.modules.map((module, mIdx) => (
                        <div key={module.id} className="space-y-1">
                            <h3 className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Module {mIdx + 1}
                            </h3>
                            <div className="space-y-0.5">
                                {module.lessons.map((lesson) => {
                                    const isActive = lesson.id === activeLessonId;
                                    const locked = isLessonLocked(lesson);
                                    return (
                                        <button
                                            key={lesson.id}
                                            onClick={() => setActiveLessonId(lesson.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-3 rounded-2xl transition-all flex items-center gap-3 font-bold group",
                                                isActive
                                                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                                                    : locked
                                                        ? "text-slate-400 hover:bg-slate-200/50"
                                                        : "text-slate-600 hover:bg-slate-200/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "size-8 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all",
                                                isActive
                                                    ? "bg-white/10 border-white/10"
                                                    : locked
                                                        ? "bg-slate-100 border-slate-100"
                                                        : completedLessonIds.has(lesson.id)
                                                            ? "bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20"
                                                            : "bg-white border-slate-200 group-hover:border-slate-300 shadow-sm"
                                            )}>
                                                {isActive ? (
                                                    <HugeiconsIcon icon={PlayIcon} className="size-3 fill-current text-white" />
                                                ) : locked ? (
                                                    <HugeiconsIcon icon={SquareLock02Icon} className="size-3 text-slate-400" />
                                                ) : completedLessonIds.has(lesson.id) ? (
                                                    <HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-white" />
                                                ) : (
                                                    <div className="size-1.5 bg-slate-300 rounded-full group-hover:bg-slate-400 transition-colors" />
                                                )}
                                            </div>
                                            <span className="truncate text-sm font-black uppercase tracking-tight">
                                                {lesson.title}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 bg-white min-h-screen">
                <div className="max-w-4xl mx-auto py-12 px-6 lg:px-12">
                    <WorkspaceButton
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label={sidebarOpen ? "Close course navigation" : "Open course navigation"}
                        className="fixed bottom-24 z-20"
                        style={{ left: sidebarOpen ? "272px" : "16px" }}
                    >
                        <HugeiconsIcon icon={Menu01Icon} className="size-5" />
                    </WorkspaceButton>

                    <div className="mb-12 flex flex-col gap-6">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Module {course.modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === activeLessonId)) + 1}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Lesson {currentIndex + 1} of {allLessons.length}
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight leading-none">
                                {activeLesson.title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="bg-emerald-500 h-full transition-all duration-1000 ease-in-out relative"
                                    style={{ width: `${progressValue}%` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-pulse" />
                                </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                                {Math.round(progressValue)}% Done
                            </span>
                        </div>
                    </div>

                    <article className="prose prose-slate prose-xl max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-img:rounded-3xl prose-img:corner-squircle prose-a:text-black relative">
                        {isLessonLocked(activeLesson) && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-3xl rounded-[40px] border-2 border-dashed border-slate-200 shadow-2xl shadow-slate-500/5 animate-in fade-in duration-500">
                                <div className="p-8 bg-white rounded-[40px] shadow-2xl flex flex-col items-center text-center max-w-xs border border-slate-100">
                                    <div className="size-20 bg-amber-50 rounded-[30px] flex items-center justify-center mb-6 shadow-inner">
                                        <HugeiconsIcon icon={SquareLock02Icon} className="size-10 text-amber-500" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Content Locked</h2>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] leading-relaxed">
                                        Complete all previous prerequisites to unlock this lesson.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className={cn(
                            "transition-all duration-700",
                            isLessonLocked(activeLesson) ? "blur-[20px] grayscale opacity-50 select-none pointer-events-none" : ""
                        )}>
                            {contentState === "LOADING" ? (
                                <div className="py-20 text-center text-sm font-bold uppercase tracking-wider text-slate-400">Loading lesson...</div>
                            ) : contentState === "ERROR" ? (
                                <div className="py-20 text-center"><p className="text-sm font-bold text-red-600">Lesson content could not be loaded.</p><button type="button" onClick={() => setContentRetry((value) => value + 1)} className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Try again</button></div>
                            ) : activeLesson.content ? (
                                <div dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                            ) : (
                                <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                                    <HugeiconsIcon icon={Layers01Icon} className="size-16 text-slate-200 mx-auto mb-6" />
                                    <p className="text-slate-400 font-bold uppercase tracking-wider">Empty lesson content</p>
                                </div>
                            )}
                        </div>
                    </article>

                    {/* Lesson Materials */}
                    {activeLesson.files && activeLesson.files.filter((file) => file.isVisible).length > 0 && !isLessonLocked(activeLesson) && (
                        <div className="mt-16 p-10 bg-slate-50 rounded-[40px] border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                <HugeiconsIcon icon={Layers01Icon} className="size-5" />
                                Lesson Resources
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {activeLesson.files.filter((file) => file.isVisible).map((file) => (
                                    <a
                                        key={file.id}
                                        href={file.fileUrl}
                                        download={file.fileName}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-5 p-5 bg-white border border-slate-100 rounded-3xl hover:border-slate-300 hover:shadow-xl transition-all group"
                                    >
                                        <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-50 group-hover:scale-110 transition-transform shadow-sm">
                                            <HugeiconsIcon icon={Book02Icon} className="size-6 text-slate-400 group-hover:text-black transition-colors" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-black text-slate-900 truncate uppercase tracking-tight font-black">{file.fileName}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                {(file.fileSize / 1024).toFixed(1)} KB FILE
                                            </span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation Footer */}
                    <footer className="mt-24 pt-10 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <WorkspaceButton
                            type="button"
                            variant="secondary"
                            onClick={() => prevLesson && setActiveLessonId(prevLesson.id)}
                            disabled={!prevLesson}
                            className={cn("w-full sm:w-auto", !prevLesson && "invisible")}
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                            Previous
                        </WorkspaceButton>

                        {nextLesson ? (
                            <WorkspaceButton
                                type="button"
                                variant="primary"
                                onClick={async () => {
                                    if (!completedLessonIds.has(activeLesson.id)) {
                                        await toggleComplete(activeLesson.id, true);
                                    }
                                    setActiveLessonId(nextLesson.id);
                                }}
                                className="w-full sm:w-auto"
                            >
                                {completedLessonIds.has(activeLesson.id) ? "Next Lesson" : "Complete & Next"}
                                <HugeiconsIcon icon={Tick01Icon} className="size-4" />
                            </WorkspaceButton>
                        ) : (
                            <WorkspaceButton
                                type="button"
                                variant={completedLessonIds.has(activeLesson.id) ? "secondary" : "primary"}
                                onClick={() => toggleComplete(activeLesson.id, !completedLessonIds.has(activeLesson.id))}
                                disabled={isUpdatingProgress}
                                className="w-full sm:w-auto"
                            >
                                <HugeiconsIcon icon={Tick01Icon} className="size-4" />
                                {completedLessonIds.has(activeLesson.id) ? "Lesson Completed" : "Mark as Finished"}
                            </WorkspaceButton>
                        )}
                    </footer>
                </div>
            </main>
        </div>
    );
}
