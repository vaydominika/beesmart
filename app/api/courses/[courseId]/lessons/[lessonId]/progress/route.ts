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
        }

        return NextResponse.json(progress);
    } catch (e) {
        console.error("PATCH /api/courses/[courseId]/lessons/[lessonId]/progress", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
