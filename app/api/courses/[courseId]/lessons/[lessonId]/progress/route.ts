import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import { canAccessCourse } from "@/lib/course-access";

type RouteContext = { params: Promise<{ courseId: string; lessonId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { courseId, lessonId } = await ctx.params;
        const { completed } = await req.json();
        if (!await canAccessCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const lesson = await prisma.courseLesson.findFirst({ where: { id: lessonId, module: { courseId } }, select: { id: true } });
        if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

        // Upsert progress
        const progress = await prisma.courseProgress.upsert({
            where: {
                userId_lessonId: { userId, lessonId }
            },
            update: {
                completedAt: completed ? new Date() : null,
                courseId, // Ensure it's linked to the correct course
                lastAccessedAt: new Date()
            },
            create: {
                userId,
                courseId,
                lessonId,
                completedAt: completed ? new Date() : null,
                lastAccessedAt: new Date()
            }
        });

        let courseCompleted = false;
        let newlyCompleted = false;

        if (completed) {
            await recordMeaningfulActivity({
                userId, activityType: "LESSON_COMPLETED", courseId, relatedId: lessonId,
                dedupeKey: `lesson:complete:${userId}:${lessonId}`,
            });

            // Check if course is now fully completed
            const allLessons = await prisma.courseLesson.findMany({
                where: { module: { courseId } },
                select: { id: true }
            });

            const completedProgress = await prisma.courseProgress.findMany({
                where: {
                    userId,
                    courseId,
                    completedAt: { not: null }
                },
                select: { lessonId: true }
            });

            const isFullyCompleted = allLessons.every((lesson: { id: string }) =>
                completedProgress.some((p: { lessonId: string }) => p.lessonId === lesson.id)
            );

            if (isFullyCompleted) {
                courseCompleted = true;
                await prisma.courseEnrollment.update({
                    where: { userId_courseId: { userId, courseId } },
                    data: { completedAt: new Date() }
                });
                const completionActivity = await recordMeaningfulActivity({
                    userId, activityType: "COURSE_COMPLETED", courseId, relatedId: courseId,
                    dedupeKey: `course:complete:${userId}:${courseId}`,
                });
                newlyCompleted = completionActivity.recorded;
                if (completionActivity.recorded) {
                    const completedCourse = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
                    await prisma.notification.create({
                        data: {
                            userId, title: "Course completed", body: `You completed ${completedCourse?.title ?? "your course"}.`,
                            type: "OTHER", category: "GENERAL", relatedId: courseId,
                            relatedType: "course", actionUrl: `/courses/${courseId}`,
                        },
                    });
                }
            }
        } else {
            // If a lesson was unmarked, ensure course is not marked as completed
            await prisma.courseEnrollment.update({
                where: { userId_courseId: { userId, courseId } },
                data: { completedAt: null }
            }).catch(() => {
                // Ignore if not enrolled or already null
            });
        }

        return NextResponse.json({ progress, courseCompleted, newlyCompleted });
    } catch (e) {
        console.error("PATCH /api/courses/[courseId]/lessons/[lessonId]/progress", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
