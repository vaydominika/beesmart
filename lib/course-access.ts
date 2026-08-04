import { prisma } from "@/lib/db";

export function accessibleCourseWhere(userId: string) {
    return {
        OR: [
            { createdById: userId },
            { visibility: "PUBLIC" as const, published: true },
            { visibility: "INVITATION_ONLY" as const, accessGrants: { some: { userId } } },
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
