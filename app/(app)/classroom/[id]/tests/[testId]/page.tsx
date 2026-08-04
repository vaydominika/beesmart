"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { TestView } from "@/components/classroom/TestView";
import { ArrowLeft } from "lucide-react";
import { TestScheduleControls } from "@/components/classroom/TestScheduleControls";

interface ClassroomDetail {
    id: string;
    name: string;
    role: string;
}

export default function TestPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;
    const testId = params.testId as string;

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
        <div className="classroom-ui mx-auto max-w-5xl space-y-6 bg-[#fffdf2] p-4 md:p-8">
            {/* Header / Back Button */}
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => router.push(`/classroom/${classroomId}`)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e6e6e0] bg-white text-[#4f534d] hover:bg-[#f1f1ec]"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-[#20231f] md:text-2xl">
                        {classroom.name}
                    </h1>
                    <span className="text-(--theme-text) opacity-30 text-xl font-light">/</span>
                    <h2 className="text-xl font-medium tracking-tight text-[#777b74] md:text-2xl">
                        Test details
                    </h2>
                </div>
            </div>

            <TestView
                classroomId={classroomId}
                testId={testId}
                isTeacher={isTeacher}
            />
            {isTeacher && (
                <TestScheduleControls
                    classroomId={classroomId}
                    testId={testId}
                    onDeleted={() => router.push(`/classroom/${classroomId}`)}
                />
            )}
        </div>
    );
}
