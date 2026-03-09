"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FancyCard } from "@/components/ui/fancycard";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    Layers01Icon,
    Tick01Icon,
    Book02Icon,
    Menu01Icon,
    PlayIcon
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Lesson {
    id: string;
    title: string;
    content: string | null;
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
        course.modules.flatMap(m => m.lessons),
        [course.modules]);

    const [activeLessonId, setActiveLessonId] = useState<string | null>(
        initialLessonId || allLessons[0]?.id || null
    );
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
        new Set(initialCompletedLessonIds)
    );
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
                    <p className="text-slate-500 font-bold uppercase tracking-wider">No lessons found in this course.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex h-full overflow-hidden bg-white">
            {/* Sidebar Syllabus */}
            <aside
                className={cn(
                    "bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300",
                    sidebarOpen ? "w-80" : "w-0 opacity-0 -translate-x-full"
                )}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <h2 className="font-black text-slate-900 uppercase tracking-tight truncate mr-2">
                        {course.title}
                    </h2>
                    <Link href={`/courses/${course.id}`} className="text-slate-400 hover:text-slate-600">
                        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {course.modules.map((module, mIdx) => (
                        <div key={module.id} className="space-y-1">
                            <h3 className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Module {mIdx + 1}: {module.title}
                            </h3>
                            <div className="space-y-0.5">
                                {module.lessons.map((lesson) => {
                                    const isActive = lesson.id === activeLessonId;
                                    return (
                                        <button
                                            key={lesson.id}
                                            onClick={() => setActiveLessonId(lesson.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 font-bold group",
                                                isActive
                                                    ? "bg-black text-white shadow-lg shadow-black/10"
                                                    : "text-slate-600 hover:bg-slate-200/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "size-6 rounded-lg flex items-center justify-center shrink-0 border-2 transition-colors",
                                                isActive
                                                    ? "bg-white/20 border-white/20"
                                                    : completedLessonIds.has(lesson.id)
                                                        ? "bg-emerald-500 border-emerald-500"
                                                        : "bg-white border-slate-200 group-hover:border-slate-300"
                                            )}>
                                                {isActive ? (
                                                    <HugeiconsIcon icon={PlayIcon} className="size-3 fill-current" />
                                                ) : completedLessonIds.has(lesson.id) ? (
                                                    <HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-white" />
                                                ) : (
                                                    <div className="size-1.5 bg-slate-300 rounded-full" />
                                                )}
                                            </div>
                                            <span className="truncate text-sm uppercase tracking-tight">
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
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Viewer Header */}
                <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-md z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        >
                            <HugeiconsIcon icon={Menu01Icon} className="size-5" />
                        </button>
                        <div className="h-4 w-px bg-slate-200" />
                        <h2 className="font-bold text-slate-900 uppercase tracking-tight truncate max-w-md">
                            {activeLesson.title}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-4">
                            Lesson {currentIndex + 1} of {allLessons.length}
                        </span>
                    </div>
                </header>

                {/* Content Container */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-12">
                        {/* Progress Bar (at top of content) */}
                        <div className="mb-8 flex items-center justify-between">
                            <div className="flex-1 mr-6">
                                <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-emerald-500 h-full transition-all duration-700 ease-in-out"
                                        style={{ width: `${progressValue}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                                {Math.round(progressValue)}% Complete
                            </span>
                        </div>

                        <article className="prose prose-slate prose-xl max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-img:rounded-3xl prose-img:corner-squircle prose-a:text-black">
                            {activeLesson.content ? (
                                <div dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                            ) : (
                                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                    <HugeiconsIcon icon={Layers01Icon} className="size-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-wider">No content has been added to this lesson yet.</p>
                                </div>
                            )}
                        </article>

                        {/* Navigation Footer */}
                        <footer className="mt-20 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <button
                                onClick={() => prevLesson && setActiveLessonId(prevLesson.id)}
                                disabled={!prevLesson}
                                className={cn(
                                    "flex items-center gap-3 px-6 py-3 rounded-2xl font-black uppercase text-sm tracking-wider transition-all border-2",
                                    prevLesson
                                        ? "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-900 hover:text-slate-900"
                                        : "opacity-0 pointer-events-none"
                                )}
                            >
                                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
                                Previous
                            </button>

                            {nextLesson ? (
                                <button
                                    onClick={async () => {
                                        if (!completedLessonIds.has(activeLesson.id)) {
                                            await toggleComplete(activeLesson.id, true);
                                        }
                                        setActiveLessonId(nextLesson.id);
                                    }}
                                    className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-wider transition-all bg-black text-white hover:opacity-90 shadow-xl shadow-black/10"
                                >
                                    {completedLessonIds.has(activeLesson.id) ? "Next Lesson" : "Complete & Next"}
                                    <HugeiconsIcon icon={Tick01Icon} className="size-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => toggleComplete(activeLesson.id, !completedLessonIds.has(activeLesson.id))}
                                    disabled={isUpdatingProgress}
                                    className={cn(
                                        "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-sm tracking-wider border-2 transition-all",
                                        completedLessonIds.has(activeLesson.id)
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            : "bg-white text-slate-900 border-slate-900"
                                    )}
                                >
                                    <HugeiconsIcon icon={Tick01Icon} className="size-5" />
                                    {completedLessonIds.has(activeLesson.id) ? "Course Completed" : "Finalize Course"}
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
}
