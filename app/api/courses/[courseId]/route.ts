import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canAccessCourse, canManageCourse } from "@/lib/course-access";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";

type RouteContext = { params: Promise<{ courseId: string }> };

// GET /api/courses/[courseId] — Get a specific course
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                modules: {
                    include: {
                        lessons: {
                            orderBy: { order: "asc" },
                            select: { id: true, title: true, order: true }
                        }
                    },
                    orderBy: { order: "asc" }
                },
                _count: { select: { enrollments: true } },
            },
        });

        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Check if user has access
        const isCreator = course.createdById === userId;
        if (!isCreator && !await canAccessCourse(courseId, userId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ ...course, isCreator });
    } catch (e) {
        console.error("GET /api/courses/[courseId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/courses/[courseId] — Update a course
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true, published: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title.trim();
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.isPublic !== undefined) updateData.isPublic = Boolean(data.isPublic);
        if (["PRIVATE", "PUBLIC", "INVITATION_ONLY"].includes(data.visibility)) {
            updateData.visibility = data.visibility;
            updateData.isPublic = data.visibility === "PUBLIC";
        }
        if (data.published !== undefined) updateData.published = Boolean(data.published);
        if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl || null;

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: updateData,
        });

        const activityType = data.published === true && !course.published ? "COURSE_PUBLISHED" : "COURSE_UPDATED";
        const fingerprint = createHash("sha1").update(JSON.stringify(data)).digest("hex");
        await recordMeaningfulActivity({
            userId, activityType, courseId, relatedId: courseId,
            dedupeKey: `course:update:${courseId}:${fingerprint}`,
        });
        if (activityType === "COURSE_PUBLISHED") {
            await prisma.notification.create({
                data: {
                    userId, title: "Course published", body: `${updated.title} is now published.`,
                    type: "OTHER", category: "GENERAL", relatedId: courseId,
                    relatedType: "course", actionUrl: `/courses/${courseId}`,
                },
            });
        }

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH /api/courses/[courseId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/courses/[courseId] — Delete a course
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { courseId } = await ctx.params;

        const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await prisma.course.delete({ where: { id: courseId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/[courseId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
