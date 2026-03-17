"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Layers01Icon,
    Tick01Icon,
    Book02Icon,
    Menu01Icon,
    PlayIcon,
    LockPasswordIcon
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Lesson {
    id: string;
    title: string;
    content: string | null;
    isLocked?: boolean;
    files?: any[];
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
        course.modules.flatMap((m: any) => m.lessons),
        [course.modules]);

    const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
        new Set(initialCompletedLessonIds)
    );

    const isLessonLocked = (lesson: Lesson) => {
        if (!lesson || !lesson.isLocked) return false;
        const index = allLessons.findIndex(l => l.id === lesson.id);
        if (index <= 0) return false;
        const previousLessonId = allLessons[index - 1].id;
        return !completedLessonIds.has(previousLessonId);
    };

    const initialLessonIdToUse = useMemo(() => {
        const initial = initialLessonId || allLessons[0]?.id || null;
        if (!initial) return null;
        const lesson = allLessons.find(l => l.id === initial);
        if (lesson && lesson.isLocked) {
            const index = allLessons.findIndex(l => l.id === initial);
            if (index > 0) {
                const prev = allLessons[index - 1];
                if (!initialCompletedLessonIds.includes(prev.id)) return allLessons[0]?.id || null;
            }
        }
        return initial;
    }, [initialLessonId, allLessons, initialCompletedLessonIds]);

    const [activeLessonId, setActiveLessonId] = useState<string | null>(initialLessonIdToUse);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

    const activeLesson = useMemo(() =>
        allLessons.find(l => l.id === activeLessonId),
        [allLessons, activeLessonId]);

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

            const newCompleted = new Set(completedLessonIds);
            if (completed) newCompleted.add(lessonId);
            else newCompleted.delete(lessonId);
            setCompletedLessonIds(newCompleted);

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
                                            onClick={() => !locked && setActiveLessonId(lesson.id)}
                                            disabled={locked}
                                            className={cn(
                                                "w-full text-left px-3 py-3 rounded-2xl transition-all flex items-center gap-3 font-bold group",
                                                isActive
                                                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                                                    : locked
                                                        ? "opacity-30 cursor-not-allowed grayscale"
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
                                                    <HugeiconsIcon icon={LockPasswordIcon} className="size-3 text-slate-400" />
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
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="fixed bottom-24 z-20 p-2 bg-white border border-slate-200 rounded-full shadow-lg hover:bg-slate-50 transition-all text-slate-500"
                        style={{ left: sidebarOpen ? "272px" : "16px" }}
                    >
                        <HugeiconsIcon icon={Menu01Icon} className="size-5" />
                    </button>

                    <div className="mb-12 flex flex-col gap-6">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-50 px-2 py-0.5 rounded-full">
                                    Module {course.modules.findIndex((m: any) => m.lessons.some((l: any) => l.id === activeLessonId)) + 1}
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

                    <article className="prose prose-slate prose-xl max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-img:rounded-3xl prose-img:corner-squircle prose-a:text-black">
                        {isLessonLocked(activeLesson) ? (
                            <div className="text-center py-20 bg-amber-50 rounded-[40px] border-2 border-dashed border-amber-200 shadow-xl shadow-amber-500/5">
                                <HugeiconsIcon icon={LockPasswordIcon} className="size-16 text-amber-200 mx-auto mb-6" />
                                <h2 className="text-amber-800 font-black uppercase tracking-tight mb-2">Content Locked</h2>
                                <p className="text-amber-600/80 font-bold uppercase tracking-wider text-sm max-w-xs mx-auto">Complete the previous lesson to unlock this knowledge.</p>
                            </div>
                        ) : activeLesson.content ? (
                            <div dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                        ) : (
                            <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                                <HugeiconsIcon icon={Layers01Icon} className="size-16 text-slate-200 mx-auto mb-6" />
                                <p className="text-slate-400 font-bold uppercase tracking-wider">Empty lesson content</p>
                            </div>
                        )}
                    </article>

                    {/* Lesson Materials */}
                    {activeLesson.files && activeLesson.files.filter((f: any) => f.isVisible).length > 0 && !isLessonLocked(activeLesson) && (
                        <div className="mt-16 p-10 bg-slate-50 rounded-[40px] border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                <HugeiconsIcon icon={Layers01Icon} className="size-5" />
                                Lesson Resources
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {activeLesson.files.filter((f: any) => f.isVisible).map((file: any) => (
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
                        <button
                            onClick={() => prevLesson && setActiveLessonId(prevLesson.id)}
                            disabled={!prevLesson}
                            className={cn(
                                "flex items-center gap-4 px-8 py-4 rounded-3xl font-black uppercase text-sm tracking-widest transition-all border-2 w-full sm:w-auto",
                                prevLesson
                                    ? "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-900 hover:text-slate-900 shadow-sm"
                                    : "opacity-0 pointer-events-none"
                            )}
                        >
                            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                            Prev
                        </button>

                        {nextLesson ? (
                            <button
                                onClick={async () => {
                                    if (!completedLessonIds.has(activeLesson.id)) {
                                        await toggleComplete(activeLesson.id, true);
                                    }
                                    setActiveLessonId(nextLesson.id);
                                }}
                                className="flex items-center gap-4 px-10 py-5 rounded-3xl font-black uppercase text-sm tracking-widest transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 w-full sm:w-auto"
                            >
                                {completedLessonIds.has(activeLesson.id) ? "Next Lesson" : "Complete & Next"}
                                <HugeiconsIcon icon={Tick01Icon} className="size-4" />
                            </button>
                        ) : (
                            <button
                                onClick={() => toggleComplete(activeLesson.id, !completedLessonIds.has(activeLesson.id))}
                                disabled={isUpdatingProgress}
                                className={cn(
                                    "flex items-center gap-4 px-10 py-5 rounded-3xl font-black uppercase text-sm tracking-widest border-2 transition-all w-full sm:w-auto",
                                    completedLessonIds.has(activeLesson.id)
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                        : "bg-slate-900 text-white border-slate-900 shadow-xl"
                                )}
                            >
                                <HugeiconsIcon icon={Tick01Icon} className="size-4" />
                                {completedLessonIds.has(activeLesson.id) ? "Lesson Completed" : "Mark as Finished"}
                            </button>
                        )}
                    </footer>
                </div>
            </main>
        </div>
    );
}
