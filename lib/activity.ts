import { prisma } from "@/lib/db";
import { updateUserStreak } from "@/lib/streak";

const COURSE_ACTIVITIES = new Set([
    "COURSE_STARTED", "COURSE_CONTINUED", "COURSE_COMPLETED", "COURSE_CREATED",
    "COURSE_UPDATED", "COURSE_PUBLISHED", "LESSON_COMPLETED",
]);
const STUDENT_CLASSROOM_ACTIVITIES = new Set([
    "ASSIGNMENT_SUBMITTED", "TEST_COMPLETED", "CLASSROOM_COURSE_COMPLETED", "CLASSROOM_TASK_COMPLETED",
]);
const TEACHER_CLASSROOM_ACTIVITIES = new Set([
    ...STUDENT_CLASSROOM_ACTIVITIES,
    "CLASSROOM_POST_PUBLISHED", "MATERIAL_UPLOADED", "ASSIGNMENT_CREATED",
    "TEST_CREATED", "TEST_SCHEDULED", "CLASSROOM_COURSE_PUBLISHED", "GRADE_PROVIDED",
]);

type RecordActivityInput = {
    userId: string;
    activityType: string;
    dedupeKey: string;
    courseId?: string | null;
    classroomId?: string | null;
    relatedId?: string | null;
};

export async function recordMeaningfulActivity(input: RecordActivityInput) {
    if (!prisma.activityRecord?.create) {
        return { recorded: false, reason: "activity_ledger_unavailable" as const };
    }
    let allowed = COURSE_ACTIVITIES.has(input.activityType);
    if (!allowed && input.classroomId) {
        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId: input.userId, classroomId: input.classroomId } },
            select: { role: true },
        });
        allowed = membership?.role === "STUDENT"
            ? STUDENT_CLASSROOM_ACTIVITIES.has(input.activityType)
            : Boolean(membership && TEACHER_CLASSROOM_ACTIVITIES.has(input.activityType));
    }

    if (!allowed) return { recorded: false, reason: "not_meaningful_for_role" as const };

    try {
        const record = await prisma.activityRecord.create({
            data: {
                userId: input.userId,
                activityType: input.activityType,
                courseId: input.courseId ?? null,
                classroomId: input.classroomId ?? null,
                relatedId: input.relatedId ?? null,
                dedupeKey: input.dedupeKey,
            },
        });
        await updateUserStreak(input.userId);
        return { recorded: true, record };
    } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
            return { recorded: false, reason: "duplicate" as const };
        }
        throw error;
    }
}
