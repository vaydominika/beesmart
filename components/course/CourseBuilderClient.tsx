"use client";

import { useState } from "react";
import CourseBuilderSidebar from "./CourseBuilderSidebar";
import CourseBuilderEditor from "./CourseBuilderEditor";
import { ViewIcon, ViewOffIcon, ZapIcon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CourseBuilderClient({ initialCourse }: { initialCourse: any }) {
    const [course, setCourse] = useState(initialCourse);
    const [isPublishing, setIsPublishing] = useState(false);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(
        initialCourse.modules?.[0]?.lessons?.[0]?.id || null
    );
    const [previewMode, setPreviewMode] = useState(false);

    // active lesson data
    const activeLesson = (course.modules || [])
        .flatMap((m: any) => m.lessons || [])
        .find((l: any) => l.id === activeLessonId);

    const handleDataChange = (newCourseData: any) => {
        setCourse(newCourseData);
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

    return (
        <>
            <div className={`transition-all duration-300 border-r ${previewMode ? "w-0 overflow-hidden opacity-0 border-r-0" : "w-80 opacity-100"}`}>
                <CourseBuilderSidebar
                    course={course}
                    onCourseChange={handleDataChange}
                    activeLessonId={activeLessonId}
                    onSelectLesson={setActiveLessonId}
                />
            </div>
            <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
                {/* Header Navbar */}
                <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        {!course.published && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Draft
                            </span>
                        )}
                        <div className="font-semibold text-sm text-slate-700">
                            {previewMode ? "Student Preview" : "Editing:"} {activeLesson?.title || "No lesson selected"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                            disabled={isPublishing}
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
                                    onLessonUpdate={(updatedLesson: any) => {
                                        // Update local state
                                        const newModules = (course.modules || []).map((m: any) => ({
                                            ...m,
                                            lessons: (m.lessons || []).map((l: any) =>
                                                l.id === updatedLesson.id ? updatedLesson : l
                                            )
                                        }));
                                        setCourse({ ...course, modules: newModules });
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
