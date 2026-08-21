"use client";

import { useParams } from "next/navigation";
import { AssignmentView } from "@/components/classroom/AssignmentView";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { useClassroomDetail } from "@/hooks/use-classroom-detail";
import { ClassroomDetailPageShell } from "@/components/classroom/ClassroomDetailPageShell";

export default function AssignmentPage() {
    const params = useParams();
    const classroomId = params.id as string;
    const assignmentId = params.assignmentId as string;

    const { classroom, loading, isStaff } = useClassroomDetail(classroomId);

    if (loading) return <WorkspaceLoadingState className="h-full py-20" label="Loading classroom" />;

    if (!classroom) return null;

    return (
        <ClassroomDetailPageShell classroomId={classroomId} classroomName={classroom.name} detailTitle="Assignment details">
            <AssignmentView classroomId={classroomId} assignmentId={assignmentId} isTeacher={isStaff} />
        </ClassroomDetailPageShell>
    );
}
