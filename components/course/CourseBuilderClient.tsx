"use client";

import { useState } from "react";
import CourseBuilderSidebar from "./CourseBuilderSidebar";
import CourseBuilderEditor from "./CourseBuilderEditor";
import { ViewIcon, ViewOffIcon, ZapIcon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CourseBuilderClient({ initialCourse }: { initialCourse: any }) {
    const [course, setCourse] = useState(initialCourse);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [autoPublish, setAutoPublish] = useState(true);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(
        initialCourse.modules?.[0]?.lessons?.[0]?.id || null
    );
    const [previewMode, setPreviewMode] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [courseTitle, setCourseTitle] = useState(course.title);

    // active lesson data
    const activeLesson = (course.modules || [])
        .flatMap((m: any) => m.lessons || [])
        .find((l: any) => l.id === activeLessonId);

    const hasUnpublishedChanges =
        activeLesson &&
        (activeLesson.contentDraft ?? activeLesson.content ?? "") !== (activeLesson.content ?? "");

    const handleDataChange = (newCourseData: any) => {
        console.log("[CourseBuilderClient] handleDataChange received:", newCourseData);
        setCourse((prev: any) => {
            const next = { ...prev, ...newCourseData };
            console.log("[CourseBuilderClient] setCourse outcome:", next);
            return next;
        });
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const res = await fetch(`/api/courses/${course.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    published: !course.published,
                    // If we are publishing, also ensure it's public so it shows in Discover
                    ...(!course.published ? { isPublic: true } : {})
                }),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setCourse((prev: any) => ({ ...prev, ...updated }));
            toast.success(updated.published ? "Course published!" : "Course set to draft.");
        } catch {
            toast.error("Failed to update course status.");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCourseUpdate = async (updates: any) => {
        try {
            const res = await fetch(`/api/courses/${course.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setCourse((prev: any) => ({ ...prev, ...updated }));
        } catch (e) {
            console.error("Failed to update course:", e);
            toast.error("Failed to save course changes.");
        }
    };

    const handlePublishLesson = async () => {
        if (!activeLessonId) return;
        setIsSaving(true);
        try {
            const activeModId = course.modules.find((m: any) => m.lessons.some((l: any) => l.id === activeLessonId))?.id;
            const res = await fetch(`/api/courses/${course.id}/modules/${activeModId}/lessons/${activeLessonId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publishNow: true }),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            toast.success("Lesson changes published to students!");

            // Update local state to reflect that it's published
            setCourse((prev: any) => {
                const nextModules = (prev.modules || []).map((m: any) => ({
                    ...m,
                    lessons: (m.lessons || []).map((l: any) =>
                        l.id === updated.id ? { ...l, content: updated.content } : l
                    )
                }));
                return { ...prev, modules: nextModules };
            });
        } catch (e) {
            toast.error("Failed to publish lesson changes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className={`transition-all duration-300 border-r ${previewMode ? "w-0 overflow-hidden opacity-0 border-r-0" : "w-80 opacity-100"}`}>
                <CourseBuilderSidebar
                    course={course}
                    onCourseChange={handleDataChange}
                    activeLessonId={activeLessonId}
                    onSelectLesson={setActiveLessonId}
                    isSaving={isSaving}
                />
            </div>
            <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
                {/* Header Navbar */}
                <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {isEditingTitle ? (
                                <input
                                    autoFocus
                                    className="text-sm font-bold text-slate-800 border-b border-primary outline-none py-0.5 px-1 bg-transparent"
                                    value={courseTitle}
                                    onChange={(e) => setCourseTitle(e.target.value)}
                                    onBlur={() => {
                                        setIsEditingTitle(false);
                                        if (courseTitle !== course.title) handleCourseUpdate({ title: courseTitle });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            setIsEditingTitle(false);
                                            if (courseTitle !== course.title) handleCourseUpdate({ title: courseTitle });
                                        }
                                    }}
                                />
                            ) : (
                                <div
                                    className="text-sm font-bold text-slate-800 hover:text-primary cursor-pointer border-b border-transparent hover:border-primary/30 py-0.5 px-1 transition-all"
                                    onClick={() => setIsEditingTitle(true)}
                                >
                                    {course.title}
                                </div>
                            )}
                            <div className="h-4 w-px bg-slate-200 mx-1" />
                            {!course.published && (
                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Draft
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-xs text-slate-500">
                                {previewMode ? "Student Preview" : "Editing:"} <span className="text-slate-700">{activeLesson?.title || "No lesson selected"}</span>
                            </div>
                            {isSaving && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full animate-pulse">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Saving...</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {!previewMode && (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Auto-Publish</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-5 w-10 p-0 rounded-full relative transition-colors border",
                                        autoPublish ? "bg-emerald-500 border-emerald-600" : "bg-slate-200 border-slate-300"
                                    )}
                                    onClick={() => setAutoPublish(!autoPublish)}
                                >
                                    <div className={cn(
                                        "absolute top-0.5 h-3.5 w-3.5 bg-white rounded-full shadow-sm transition-all",
                                        autoPublish ? "right-1" : "left-1"
                                    )} />
                                </Button>
                            </div>
                        )}

                        {!autoPublish && !previewMode && (
                            <Button
                                size="sm"
                                onClick={handlePublishLesson}
                                disabled={isSaving || !activeLessonId || !hasUnpublishedChanges}
                                className={cn(
                                    "font-bold h-8 px-4 transition-all",
                                    hasUnpublishedChanges
                                        ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                )}
                            >
                                <ZapIcon className="h-3.5 w-3.5 mr-2" />
                                {hasUnpublishedChanges ? "Publish Changes" : "No changes to publish"}
                            </Button>
                        )}

                        <div className="h-8 w-px bg-slate-200" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewMode(!previewMode)}
                            className={previewMode ? "text-primary bg-primary/10" : "text-slate-500"}
                        >
                            {previewMode ? <ViewIcon className="h-4 w-4 mr-2" /> : <ViewOffIcon className="h-4 w-4 mr-2" />}
                            Preview
                        </Button>
                        <Button
                            size="sm"
                            onClick={handlePublish}
                            disabled={isPublishing || isSaving}
                            className={course.published ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "bg-black text-white hover:bg-black/90"}
                        >
                            <ZapIcon className="h-3.5 w-3.5 mr-2" />
                            {course.published ? "Unpublish" : "Publish Course"}
                        </Button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden w-full relative">
                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto w-full relative">
                        {activeLesson ? (
                            <div className="max-w-4xl mx-auto py-8 px-6">
                                <CourseBuilderEditor
                                    lesson={activeLesson}
                                    courseId={course.id}
                                    previewMode={previewMode}
                                    autoPublish={autoPublish}
                                    onSavingChange={setIsSaving}
                                    onLessonUpdate={(updatedLesson: any) => {
                                        console.log("[CourseBuilderClient] onLessonUpdate for ID:", updatedLesson.id, "Payload:", updatedLesson);
                                        setCourse((prev: any) => {
                                            const nextModules = (prev.modules || []).map((m: any) => ({
                                                ...m,
                                                lessons: (m.lessons || []).map((l: any) =>
                                                    l.id === updatedLesson.id ? { ...l, ...updatedLesson } : l
                                                )
                                            }));
                                            const next = { ...prev, modules: nextModules };
                                            console.log("[CourseBuilderClient] setCourse (onLessonUpdate) outcome:", next);
                                            return next;
                                        });
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 p-8 text-center flex-col">
                                <p className="mb-4 text-lg text-slate-500">Select or create a lesson to start editing</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}
