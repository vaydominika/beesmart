"use client";

import { useText } from "@/i18n/use-text";

import { useParams } from "next/navigation";
import { AssignmentView } from "@/components/classroom/AssignmentView";
import { WorkspaceLoadingState } from "@/components/ui/workspace-state";
import { useClassroomDetail } from "@/hooks/use-classroom-detail";
import { ClassroomDetailPageShell } from "@/components/classroom/ClassroomDetailPageShell";

export default function AssignmentPage() {
  const t = useText();
    const params = useParams();
    const classroomId = params.id as string;
    const assignmentId = params.assignmentId as string;

    const { classroom, loading, isStaff } = useClassroomDetail(classroomId);

    if (loading) return <WorkspaceLoadingState className="h-full py-20" label={t("Loading classroom")} />;

    if (!classroom) return null;

    return (
        <ClassroomDetailPageShell classroomId={classroomId} classroomName={classroom.name} detailTitle={t("Assignment details")}>
            <AssignmentView classroomId={classroomId} assignmentId={assignmentId} isTeacher={isStaff} />
        </ClassroomDetailPageShell>
    );
}
