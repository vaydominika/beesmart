import { prisma } from "@/lib/db";

function deadlineTime(deadlineAt: Date, timeZone: string, hasTime: boolean) {
    if (!hasTime) return null;
    return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(deadlineAt);
}

export async function syncAssignmentCalendarEvent(assignmentId: string) {
    const assignment = await prisma.assignedWork.findUnique({ where: { id: assignmentId } });
    if (!assignment?.classroomId) return null;

    const dueTime = deadlineTime(
        assignment.deadlineAt,
        assignment.deadlineTimeZone,
        assignment.deadlineHasTime,
    );

    return prisma.event.upsert({
        where: { assignmentId },
        create: {
            title: `Assignment: ${assignment.title}`,
            description: assignment.description,
            startDate: assignment.deadlineAt,
            endDate: assignment.deadlineAt,
            startTime: dueTime,
            endTime: dueTime,
            isAllDay: !assignment.deadlineHasTime,
            isProtected: true,
            classroomId: assignment.classroomId,
            assignmentId,
        },
        update: {
            title: `Assignment: ${assignment.title}`,
            description: assignment.description,
            startDate: assignment.deadlineAt,
            endDate: assignment.deadlineAt,
            startTime: dueTime,
            endTime: dueTime,
            isAllDay: !assignment.deadlineHasTime,
            isProtected: true,
            classroomId: assignment.classroomId,
            color: null,
        },
    });
}
