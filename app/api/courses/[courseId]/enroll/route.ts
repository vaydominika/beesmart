import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import { canAccessCourse } from "@/lib/course-access";

type RouteContext = { params: Promise<{ courseId: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { courseId } = await ctx.params;

        if (!await canAccessCourse(courseId, userId)) {
            return NextResponse.json({ error: "Course not available for enrollment" }, { status: 403 });
        }

        // Create enrollment
        const enrollment = await prisma.courseEnrollment.upsert({
            where: {
                userId_courseId: { userId, courseId }
            },
            update: {}, // If already enrolled, do nothing
            create: {
                userId,
                courseId
            }
        });
        await recordMeaningfulActivity({
            userId, activityType: "COURSE_STARTED", courseId, relatedId: courseId,
            dedupeKey: `course:start:${userId}:${courseId}`,
        });

        return NextResponse.json(enrollment);
    } catch (e) {
        console.error("POST /api/courses/[courseId]/enroll", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
