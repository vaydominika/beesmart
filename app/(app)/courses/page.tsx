"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FancyButton } from "@/components/ui/fancybutton";
import { CreateCourseModal } from "@/components/course/CreateCourseModal";
import { CourseCard } from "@/components/course/CourseCard";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";

export default function CoursesPage() {
    const router = useRouter();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchCourses = useCallback(async () => {
        try {
            const res = await fetch("/api/courses");
            if (!res.ok) return;
            const data = await res.json();
            setCourses(data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    const handleCreated = (course: any) => {
        setCourses((prev) => [course, ...prev]);
        router.push(`/courses/${course.id}/builder`);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <h1 className="text-3xl md:text-5xl font-bold text-(--theme-text) uppercase tracking-tight">
                    My Courses
                </h1>
                <div className="flex gap-3">
                    <FancyButton
                        onClick={() => setCreateOpen(true)}
                        className="text-(--theme-text) text-xs md:text-base font-bold uppercase px-4 py-1.5"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Continue
                    </FancyButton>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Spinner />
                </div>
            ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="text-6xl mb-4">📚</div>
                    <h2 className="text-xl md:text-2xl font-bold text-(--theme-text) uppercase mb-2">
                        No Courses Yet
                    </h2>
                    <p className="text-sm text-(--theme-text) opacity-60 max-w-md mb-6">
                        Create a new course to organize your learning materials, or enroll in an existing one.
                    </p>
                    <div className="flex gap-3">
                        <FancyButton
                            onClick={() => setCreateOpen(true)}
                            className="text-(--theme-text) text-sm font-bold uppercase px-4 py-1.5"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Continue
                        </FancyButton>
                    </div>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Active Courses */}
                    {courses.filter(c => c.progress < 100).length > 0 && (
                        <section>
                            <h2 className="text-xl md:text-2xl font-bold text-(--theme-text) uppercase tracking-tight mb-6">
                                Active Courses
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {courses.filter(c => c.progress < 100).map((c) => (
                                    <CourseCard
                                        key={c.id}
                                        {...c}
                                        progress={undefined} // Creators don't see progress
                                        onClick={() => router.push(`/courses/${c.id}/builder`)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Finished Courses */}
                    {courses.filter(c => c.progress === 100).length > 0 && (
                        <section>
                            <h2 className="text-xl md:text-2xl font-bold text-emerald-600 uppercase tracking-tight mb-6">
                                Finished Courses
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {courses.filter(c => c.progress === 100).map((c) => (
                                    <CourseCard
                                        key={c.id}
                                        {...c}
                                        onClick={() => router.push(`/courses/${c.id}`)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* Modals */}
            <CreateCourseModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={handleCreated}
            />
        </div>
    );
}
