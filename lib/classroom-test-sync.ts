import { prisma } from "@/lib/db";

function timeValue(date: Date | null) {
    if (!date) return null;
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function syncTestCalendarEvent(testId: string) {
    const test = await prisma.test.findUnique({
        where: { id: testId },
        include: { classroom: { select: { color: true } } },
    });
    if (!test?.classroomId) return null;

    if (!test.opensAt) {
        await prisma.event.deleteMany({ where: { testId } });
        return null;
    }

    const title = `${test.type === "EXAM" ? "Exam" : "Test"}: ${test.title}`;
    return prisma.event.upsert({
        where: { testId },
        create: {
            title,
            description: test.description,
            startDate: test.opensAt,
            endDate: test.closesAt ?? test.opensAt,
            startTime: timeValue(test.opensAt),
            endTime: timeValue(test.closesAt),
            isAllDay: false,
            isProtected: true,
            classroomId: test.classroomId,
            testId,
            color: test.classroom?.color,
        },
        update: {
            title,
            description: test.description,
            startDate: test.opensAt,
            endDate: test.closesAt ?? test.opensAt,
            startTime: timeValue(test.opensAt),
            endTime: timeValue(test.closesAt),
            isAllDay: false,
            isProtected: true,
            classroomId: test.classroomId,
            color: test.classroom?.color,
        },
    });
}

