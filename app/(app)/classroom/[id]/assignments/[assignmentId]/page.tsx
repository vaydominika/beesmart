"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { FancyCard } from "@/components/ui/fancycard";
import { FancyButton } from "@/components/ui/fancybutton";
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

    const isTeacher = classroom.role === "TEACHER" || classroom.role === "TA";

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header / Back Button */}
            <div className="flex items-center gap-4">
                <FancyButton
                    onClick={() => router.push(`/classroom/${classroomId}`)}
                    className="text-(--theme-text) p-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                </FancyButton>
                <div className="flex items-center gap-3">
                    <h1 className="text-xl md:text-2xl font-bold text-(--theme-text) tracking-tight">
                        {classroom.name}
                    </h1>
                    <span className="text-(--theme-text) opacity-30 text-xl font-light">/</span>
                    <h2 className="text-xl md:text-2xl font-bold text-(--theme-text) opacity-60 tracking-tight">
                        Assignment Details
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
