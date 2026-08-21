"use client";

import { useRouter, useParams } from "next/navigation";
import { TestView } from "@/components/classroom/TestView";
import { TestScheduleControls } from "@/components/classroom/TestScheduleControls";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { useClassroomDetail } from "@/hooks/use-classroom-detail";
import { ClassroomDetailPageShell } from "@/components/classroom/ClassroomDetailPageShell";

export default function TestPage() {
    const router = useRouter();
    const params = useParams();
    const classroomId = params.id as string;
    const testId = params.testId as string;

    const { classroom, loading, isStaff } = useClassroomDetail(classroomId);

    if (loading) return <WorkspaceLoadingState className="h-full py-20" label="Loading classroom" />;

    if (!classroom) return null;

    return (
        <ClassroomDetailPageShell classroomId={classroomId} classroomName={classroom.name} detailTitle="Test details">
            <TestView classroomId={classroomId} testId={testId} isTeacher={isStaff} />
            {isStaff && (
                <TestScheduleControls
                    classroomId={classroomId}
                    testId={testId}
                    onDeleted={() => router.push(`/classroom/${classroomId}`)}
                />
            )}
        </ClassroomDetailPageShell>
    );
}
