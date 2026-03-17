import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { updateUserStreak } from "@/lib/streak";

type RouteContext = { params: Promise<{ courseId: string; lessonId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { courseId, lessonId } = await ctx.params;
        const { completed } = await req.json();

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

        if (completed) {
            await updateUserStreak(userId);

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
                await prisma.courseEnrollment.update({
                    where: { userId_courseId: { userId, courseId } },
                    data: { completedAt: new Date() }
                });
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

        return NextResponse.json(progress);
    } catch (e) {
        console.error("PATCH /api/courses/[courseId]/lessons/[lessonId]/progress", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
