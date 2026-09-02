"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FileText,
    Layers3,
    LockKeyhole,
    Menu,
    Play,
    X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkspaceButton } from "@/components/ui/workspace-button";
import { CourseRatingModal } from "@/components/course/CourseRatingModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    const [mobileSyllabusOpen, setMobileSyllabusOpen] = useState(false);
    const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
    const [ratingOpen, setRatingOpen] = useState(false);
    const [lessonContent, setLessonContent] = useState<Record<string, { content: string | null; files: LessonFile[] }>>(() => Object.fromEntries(
        allLessons
            .filter((lesson) => lesson.content !== undefined)
            .map((lesson) => [lesson.id, { content: lesson.content ?? null, files: lesson.files ?? [] }]),
    ));
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
        const courseModule = course.modules.find((item) => item.lessons.some((candidate) => candidate.id === activeLessonId));
        if (!courseModule) return;
        const controller = new AbortController();
        setContentState("LOADING");
        fetch(`/api/courses/${course.id}/modules/${courseModule.id}/lessons/${activeLessonId}`, { signal: controller.signal })
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

    const toggleComplete = async (lessonId: string, completed: boolean): Promise<boolean> => {
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
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setIsUpdatingProgress(false);
        }
    };

    const completedCount = useMemo(
        () => allLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
        [allLessons, completedLessonIds],
    );
    const progressValue = allLessons.length > 0 ? (completedCount / allLessons.length) * 100 : 0;
    const activeModuleIndex = course.modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === activeLessonId));
    const activeCompleted = activeLesson ? completedLessonIds.has(activeLesson.id) : false;
    const visibleFiles = activeLesson?.files?.filter((file) => file.isVisible) ?? [];

    const selectLesson = (lessonId: string) => {
        setActiveLessonId(lessonId);
        setMobileSyllabusOpen(false);
    };

    const syllabus = (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-surface)]">
            <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-[var(--course-line)] px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    <WorkspaceButton asChild variant="secondary" size="icon-compact">
                        <Link href={`/courses/${course.id}`} aria-label="Back to course overview"><ArrowLeft className="h-4 w-4" /></Link>
                    </WorkspaceButton>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-[var(--course-text)]">Syllabus</h2>
                        <p className="mt-1 text-[10px] text-[var(--course-text-muted)]">{course.modules.length} modules · {allLessons.length} lessons</p>
                    </div>
                </div>
                <WorkspaceButton type="button" variant="ghost" size="icon-compact" onClick={() => setMobileSyllabusOpen(false)} aria-label="Close syllabus" className="lg:hidden">
                    <X className="h-4 w-4" />
                </WorkspaceButton>
            </div>

            <div className="course-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
                {course.modules.map((courseModule, moduleIndex) => (
                    <section key={courseModule.id} className="border-b border-[var(--course-line)] pb-2 last:border-b-0">
                        <div className="flex items-center gap-2.5 px-2.5 py-2.5">
                            <span className="flex h-6 min-w-6 items-center justify-center px-1 text-[10px] font-semibold text-[var(--course-text-faint)]">
                                {String(moduleIndex + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                                <Tooltip><TooltipTrigger asChild><h3 className="truncate text-xs font-semibold text-[var(--course-text)]">{courseModule.title}</h3></TooltipTrigger><TooltipContent>{courseModule.title}</TooltipContent></Tooltip>
                                <p className="mt-0.5 text-[9px] text-[var(--course-text-faint)]">{courseModule.lessons.length} {courseModule.lessons.length === 1 ? "lesson" : "lessons"}</p>
                            </div>
                        </div>

                        <ol className="space-y-0.5 p-1.5">
                            {courseModule.lessons.map((lesson, lessonIndex) => {
                                const isActive = lesson.id === activeLessonId;
                                const locked = isLessonLocked(lesson);
                                const completed = completedLessonIds.has(lesson.id);
                                return (
                                    <li key={lesson.id}>
                                        <button
                                            type="button"
                                            aria-label={lesson.title}
                                            onClick={() => selectLesson(lesson.id)}
                                            aria-current={isActive ? "step" : undefined}
                                            className={cn(
                                                "group flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-ring)]",
                                                isActive
                                                    ? "border-[var(--course-line)] bg-[var(--course-surface-muted)] text-[var(--course-text)]"
                                                    : "border-transparent text-[var(--course-text-muted)] hover:bg-[var(--course-surface-muted)] hover:text-[var(--course-text)]",
                                            )}
                                        >
                                            <span className={cn(
                                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[9px] font-semibold",
                                                completed
                                                    ? "border-[var(--course-success)] bg-[var(--course-success-soft)] text-[var(--course-success)]"
                                                    : isActive
                                                        ? "border-[var(--course-line-strong)] bg-[var(--app-surface)] text-[var(--course-text)]"
                                                        : "border-[var(--course-line)] bg-[var(--app-surface)] text-[var(--course-text-faint)]",
                                            )}>
                                                {locked ? <LockKeyhole className="h-3.5 w-3.5" /> : completed ? <Check className="h-3.5 w-3.5" /> : isActive ? <Play className="h-3 w-3 fill-current" /> : `${moduleIndex + 1}.${lessonIndex + 1}`}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{lesson.title}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))}
            </div>
        </div>
    );

    if (!activeLesson) {
        return (
            <div className="course-ui flex h-full flex-1 items-center justify-center bg-[var(--course-canvas)] px-6">
                <div className="rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] px-8 py-10 text-center shadow-none">
                    <BookOpen className="mx-auto h-6 w-6 text-[var(--course-text-faint)]" />
                    <h1 className="mt-4 text-lg font-semibold text-[var(--course-text)]">This course has no lessons yet</h1>
                    <p className="mt-2 text-sm text-[var(--course-text-muted)]">Return to the course overview to check again later.</p>
                    <WorkspaceButton asChild variant="secondary" className="mt-5"><Link href={`/courses/${course.id}`}>Back to course</Link></WorkspaceButton>
                </div>
            </div>
        );
    }

    return (
        <div className="course-ui course-viewer flex h-full min-h-0 w-full overflow-hidden bg-[var(--course-canvas)] text-[var(--course-text)]">
            <CourseRatingModal open={ratingOpen} onOpenChange={setRatingOpen} courseId={course.id} />
            <aside className="hidden h-full w-[298px] shrink-0 border-r border-[var(--course-line)] bg-[var(--app-surface)] lg:block">{syllabus}</aside>

            {mobileSyllabusOpen && (
                <>
                    <button type="button" aria-label="Dismiss syllabus" onClick={() => setMobileSyllabusOpen(false)} className="fixed inset-0 z-40 bg-[var(--app-scrim-soft)] lg:hidden" />
                    <aside className="fixed inset-y-0 left-0 z-50 w-[min(88vw,330px)] border-r border-[var(--course-line)] bg-[var(--app-surface)] shadow-none lg:hidden">{syllabus}</aside>
                </>
            )}

            <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="h-[76px] shrink-0 border-b border-[var(--course-line)] bg-[var(--app-surface)]">
                    <div className="flex h-full items-center gap-2 px-3 md:px-5">
                        <WorkspaceButton type="button" variant="secondary" size="icon" onClick={() => setMobileSyllabusOpen(true)} aria-label="Open syllabus" className="lg:hidden"><Menu className="h-4 w-4" /></WorkspaceButton>

                        <div className="min-w-0 flex-1 px-1">
                            <h1 className="truncate text-sm font-semibold tracking-[-0.015em] text-[var(--course-text)] md:text-base">{course.title}</h1>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--course-text-muted)]">
                                <span>{completedCount} of {allLessons.length} complete</span>
                                <span aria-hidden="true">·</span>
                                <span>{Math.round(progressValue)}%</span>
                            </div>
                        </div>

                        <div className="hidden w-40 items-center gap-3 sm:flex lg:w-52">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--course-surface-muted)]" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressValue)}>
                                <div className="h-full rounded-full bg-[var(--course-success)] transition-[width]" style={{ width: `${progressValue}%` }} />
                            </div>
                            <span className="w-8 text-right text-[10px] font-semibold text-[var(--course-text-muted)]">{Math.round(progressValue)}%</span>
                        </div>
                    </div>
                </header>

                <main className="course-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--course-canvas)]">
                    <div className="mx-auto w-full max-w-5xl p-3 sm:p-4 md:p-6">
                        <article className="overflow-hidden rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] shadow-none">
                            <header className="border-b border-[var(--course-line)] bg-[var(--app-surface)] px-5 py-6 sm:px-7 md:px-10 md:py-8">
                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[var(--course-text-muted)]">
                                    <span className="rounded-md border border-[var(--course-line)] bg-[var(--course-surface-muted)] px-2 py-1">Module {activeModuleIndex + 1}</span>
                                    <span>Lesson {currentIndex + 1} of {allLessons.length}</span>
                                    {activeCompleted && <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--course-success)]"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span>}
                                </div>
                                <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.035em] text-[var(--course-text)] sm:text-3xl md:text-[38px]">{activeLesson.title}</h2>
                            </header>

                            <div className="min-h-[420px] px-5 py-7 sm:px-7 md:px-10 md:py-10">
                                {isLessonLocked(activeLesson) ? (
                                    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--course-line-strong)] bg-[var(--course-surface-muted)] px-6 text-center">
                                        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)]"><LockKeyhole className="h-5 w-5 text-[var(--course-text-muted)]" /></span>
                                        <h3 className="mt-4 text-lg font-semibold text-[var(--course-text)]">Complete the earlier prerequisites</h3>
                                        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--course-text-muted)]">This lesson opens after the required lessons before it are complete.</p>
                                    </div>
                                ) : contentState === "LOADING" ? (
                                    <div role="status" className="flex min-h-72 flex-col items-center justify-center text-sm text-[var(--course-text-muted)]"><BookOpen className="mb-3 h-5 w-5 animate-pulse" />Loading lesson…</div>
                                ) : contentState === "ERROR" ? (
                                    <div className="flex min-h-72 flex-col items-center justify-center text-center"><p className="text-sm font-semibold text-[var(--course-danger)]">Lesson content could not be loaded</p><p className="mt-1 text-xs text-[var(--course-text-muted)]">Check your connection and try again.</p><WorkspaceButton type="button" variant="secondary" onClick={() => setContentRetry((value) => value + 1)} className="mt-4">Try again</WorkspaceButton></div>
                                ) : activeLesson.content ? (
                                    <div className="prose prose-slate max-w-none text-[15px] leading-7 text-[var(--course-text-muted)] dark:prose-invert prose-headings:text-[var(--course-text)] prose-headings:font-semibold prose-headings:tracking-[-0.025em] prose-h2:mt-10 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:my-4 prose-strong:text-[var(--course-text)] prose-a:text-[var(--course-accent-text)] prose-li:my-1 prose-blockquote:border-[var(--course-focus-border)] prose-blockquote:text-[var(--course-text-muted)] prose-code:text-[var(--course-text)] prose-img:rounded-2xl" dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                                ) : (
                                    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--course-line)] bg-[var(--course-surface-muted)] px-6 text-center"><BookOpen className="h-5 w-5 text-[var(--course-text-faint)]" /><p className="mt-3 text-sm font-medium text-[var(--course-text-muted)]">This lesson does not have content yet.</p></div>
                                )}
                            </div>

                            {visibleFiles.length > 0 && !isLessonLocked(activeLesson) && (
                                <section className="border-t border-[var(--course-line)] bg-[var(--course-surface-muted)] px-5 py-6 sm:px-7 md:px-10" aria-labelledby="lesson-resources-heading">
                                    <div className="flex items-center gap-2">
                                        <Layers3 className="h-4 w-4 text-[var(--course-text-muted)]" />
                                        <h3 id="lesson-resources-heading" className="text-sm font-semibold text-[var(--course-text)]">Lesson resources</h3>
                                    </div>
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        {visibleFiles.map((file) => (
                                            <a key={file.id} href={file.fileUrl} download={file.fileName} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] p-3 transition-colors hover:border-[var(--course-line-strong)] hover:bg-[var(--course-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--course-focus-ring)]">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--course-accent)]"><FileText className="h-4 w-4 text-[var(--course-text-muted)]" /></span>
                                                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--course-text)]">{file.fileName}</span><span className="mt-0.5 block text-[9px] text-[var(--course-text-faint)]">{Math.max(0.1, file.fileSize / 1024).toFixed(1)} KB</span></span>
                                            </a>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </article>

                        <nav aria-label="Lesson navigation" className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--course-line)] bg-[var(--app-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <WorkspaceButton type="button" variant="secondary" onClick={() => prevLesson && selectLesson(prevLesson.id)} disabled={!prevLesson} className="w-full sm:w-auto"><ChevronLeft className="h-4 w-4" />Previous lesson</WorkspaceButton>
                            <span className="order-first text-center text-[10px] font-semibold text-[var(--course-text-muted)] sm:order-none">{String(currentIndex + 1).padStart(2, "0")} / {String(allLessons.length).padStart(2, "0")}</span>
                            {nextLesson ? (
                                <WorkspaceButton
                                    type="button"
                                    variant="primary"
                                    disabled={isUpdatingProgress || isLessonLocked(activeLesson)}
                                    onClick={async () => {
                                        const canContinue = activeCompleted || await toggleComplete(activeLesson.id, true);
                                        if (canContinue) selectLesson(nextLesson.id);
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    {activeCompleted ? "Next lesson" : "Complete & continue"}<ChevronRight className="h-4 w-4" />
                                </WorkspaceButton>
                            ) : (
                                <WorkspaceButton type="button" variant={activeCompleted ? "secondary" : "primary"} onClick={() => void toggleComplete(activeLesson.id, !activeCompleted)} disabled={isUpdatingProgress || isLessonLocked(activeLesson)} className="w-full sm:w-auto">
                                    <Check className="h-4 w-4" />{activeCompleted ? "Mark incomplete" : "Complete course"}
                                </WorkspaceButton>
                            )}
                        </nav>
                    </div>
                </main>
            </section>
        </div>
    );
}
