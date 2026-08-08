import { prisma } from "@/lib/db";

export function classroomCourseAccessWhere(userId: string) {
    return {
        published: true,
        visibility: { not: "PRIVATE" as const },
        OR: [
            { classroom: { is: { members: { some: { userId } } } } },
            { classroomLinks: { some: { classroom: { members: { some: { userId } } } } } },
        ],
    };
}

export function accessibleCourseWhere(userId: string) {
    return {
        OR: [
            { createdById: userId },
            { visibility: "PUBLIC" as const, published: true },
            { visibility: "INVITATION_ONLY" as const, accessGrants: { some: { userId } } },
            classroomCourseAccessWhere(userId),
        ],
    };
}

export async function canAccessCourse(courseId: string, userId: string) {
    const course = await prisma.course.findFirst({
        where: { id: courseId, ...accessibleCourseWhere(userId) },
        select: { id: true },
    });
    return Boolean(course);
}

export async function canManageCourse(courseId: string, userId: string) {
    const course = await prisma.course.findFirst({
        where: { id: courseId, createdById: userId },
        select: { id: true },
    });
    return Boolean(course);
}

export type LessonAccessResult =
    | { allowed: true; lessonId: string; isCreator: boolean }
    | { allowed: false; reason: "COURSE_NOT_FOUND" | "COURSE_FORBIDDEN" | "LESSON_NOT_FOUND" | "LESSON_LOCKED"; blockingLessonIds?: string[] };

export async function getLessonAccess({
    courseId,
    moduleId,
    lessonId,
    userId,
}: {
    courseId: string;
    moduleId?: string;
    lessonId: string;
    userId: string;
}): Promise<LessonAccessResult> {
    if (!await canAccessCourse(courseId, userId)) {
        const exists = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
        return { allowed: false, reason: exists ? "COURSE_FORBIDDEN" : "COURSE_NOT_FOUND" };
    }

    const lesson = await prisma.courseLesson.findFirst({
        where: {
            id: lessonId,
            module: { id: moduleId, courseId },
        },
        select: { id: true, moduleId: true, module: { select: { course: { select: { createdById: true } } } } },
    });
    if (!lesson) return { allowed: false, reason: "LESSON_NOT_FOUND" };
    if (lesson.module.course.createdById === userId) return { allowed: true, lessonId, isCreator: true };

    const modules = await prisma.courseModule.findMany({
        where: { courseId },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
            lessons: {
                orderBy: [{ order: "asc" }, { id: "asc" }],
                select: { id: true, isLocked: true },
            },
        },
    });
    const lessons = (modules as Array<{ lessons: Array<{ id: string; isLocked: boolean }> }>).flatMap((module) => module.lessons);
    const targetIndex = lessons.findIndex((candidate: { id: string }) => candidate.id === lessonId);
    if (targetIndex < 0) return { allowed: false, reason: "LESSON_NOT_FOUND" };

    const prerequisiteIds = lessons.slice(0, targetIndex).filter((candidate: { isLocked: boolean }) => candidate.isLocked).map((candidate: { id: string }) => candidate.id);
    if (prerequisiteIds.length === 0) return { allowed: true, lessonId, isCreator: false };
    const completed = await prisma.courseProgress.findMany({
        where: { userId, courseId, lessonId: { in: prerequisiteIds }, completedAt: { not: null } },
        select: { lessonId: true },
    });
    const completedIds = new Set((completed as Array<{ lessonId: string }>).map((progress) => progress.lessonId));
    const blockingLessonIds = prerequisiteIds.filter((id: string) => !completedIds.has(id));
    return blockingLessonIds.length > 0
        ? { allowed: false, reason: "LESSON_LOCKED", blockingLessonIds }
        : { allowed: true, lessonId, isCreator: false };
}
