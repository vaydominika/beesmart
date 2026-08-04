"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { AssignmentView } from "@/components/classroom/AssignmentView";
import { ArrowLeft } from "lucide-react";

interface ClassroomDetail {
    id: string;
    name: string;
    role: string;
}

export default function AssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;
    const assignmentId = params.assignmentId as string;

    const [classroom, setClassroom] = useState<ClassroomDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchClassroom = useCallback(async () => {
        try {
            const res = await fetch(`/api/classrooms/${classroomId}`);
            if (!res.ok) {
                toast.error("Classroom not found.");
                router.push("/classroom");
                return;
            }
            const data = await res.json();
            setClassroom(data);
        } catch {
            toast.error("Failed to load classroom.");
            router.push("/classroom");
        } finally {
            setLoading(false);
        }
    }, [classroomId, router]);

    useEffect(() => {
        fetchClassroom();
    }, [fetchClassroom]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-20">
                <Spinner />
            </div>
        );
    }

    if (!classroom) return null;

    const isTeacher = classroom.role === "TEACHER" || classroom.role === "TEACHING_ASSISTANT";

    return (
        <div className="classroom-ui mx-auto max-w-5xl space-y-6 bg-[var(--classroom-canvas)] p-4 md:p-8">
            {/* Header / Back Button */}
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => router.push(`/classroom/${classroomId}`)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--classroom-line)] bg-white text-[var(--classroom-text-muted)] hover:bg-[var(--classroom-surface-muted)]"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-[var(--classroom-text)] md:text-2xl">
                        {classroom.name}
                    </h1>
                    <span className="text-(--theme-text) opacity-30 text-xl font-light">/</span>
                    <h2 className="text-xl font-medium tracking-tight text-[var(--classroom-text-muted)] md:text-2xl">
                        Assignment details
                    </h2>
                </div>
            </div>

            <AssignmentView
                classroomId={classroomId}
                assignmentId={assignmentId}
                isTeacher={isTeacher}
            />
        </div>
    );
}
