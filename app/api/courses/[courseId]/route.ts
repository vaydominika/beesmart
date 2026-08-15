import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canAccessCourse, canManageCourse } from "@/lib/course-access";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";
import type { Prisma } from "@/lib/generated/prisma";
import { claimUploads, markFilesForDeletion, purgeStoredFiles, UploadClaimError } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";
import { auditCourseForPublishing, CoursePublishAuditUnavailableError } from "@/lib/course-audit";
import { COURSE_TITLE_MAX_LENGTH, normalizeCourseTitle } from "@/lib/course-title";

type RouteContext = { params: Promise<{ courseId: string }> };
type ManageCourseRecord = {
    id: string;
    title: string;
    description: string | null;
    createdById: string;
    published: boolean;
    coverStoredFileId: string | null;
    modules: Array<{
        title: string;
        description: string | null;
        lessons: Array<{ id: string; title: string; description: string | null; content: string | null; contentDraft: string | null }>;
    }>;
};
type StoredFileReference = { storedFileId: string | null };
type DeleteCourseRecord = {
    createdById: string;
    coverStoredFileId: string | null;
    files: StoredFileReference[];
    modules: Array<{ lessons: Array<{ files: StoredFileReference[] }> }>;
};

export const maxDuration = 120;

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

        return NextResponse.json({ ...course, coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null, isCreator });
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

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: {
                modules: {
                    orderBy: { order: "asc" },
                    include: {
                        lessons: {
                            orderBy: { order: "asc" },
                            select: { id: true, title: true, description: true, content: true, contentDraft: true },
                        },
                    },
                },
            },
        }) as ManageCourseRecord | null;
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const data = await req.json();
        const updateData: Prisma.CourseUncheckedUpdateInput = {};
        if (data.title !== undefined) {
            const normalizedTitle = normalizeCourseTitle(data.title);
            if (!normalizedTitle) {
                const error = typeof data.title === "string" && data.title.trim().length > COURSE_TITLE_MAX_LENGTH
                    ? `Course title must be ${COURSE_TITLE_MAX_LENGTH} characters or fewer.`
                    : "Title is required";
                return NextResponse.json({ error }, { status: 400 });
            }
            updateData.title = normalizedTitle;
        }
        if (data.description !== undefined) updateData.description = data.description?.trim() || null;
        if (data.isPublic !== undefined) updateData.isPublic = Boolean(data.isPublic);
        if (["PRIVATE", "PUBLIC", "INVITATION_ONLY"].includes(data.visibility)) {
            updateData.visibility = data.visibility;
            updateData.isPublic = data.visibility === "PUBLIC";
        }
        const isPublishRequest = data.published === true;
        if (data.published !== undefined) updateData.published = Boolean(data.published);
        if (data.coverImageUrl !== undefined) return NextResponse.json({ error: "Use coverUploadId for local cover images" }, { status: 400 });

        if (isPublishRequest) {
            const audit = await auditCourseForPublishing(course);
            if (!audit.publishable) {
                return NextResponse.json({
                    error: "The course cannot be published.",
                    code: "COURSE_NOT_PUBLISHABLE",
                    issues: audit.blockingIssues,
                }, { status: 422 });
            }
        }

        let replacedCoverIds: string[] = [];
        const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (isPublishRequest) {
                for (const lesson of course.modules.flatMap((module) => module.lessons)) {
                    if (lesson.contentDraft !== null) {
                        await tx.courseLesson.update({
                            where: { id: lesson.id },
                            data: { content: lesson.contentDraft },
                        });
                    }
                }
            }
            if (data.coverUploadId !== undefined) {
                const coverIds = typeof data.coverUploadId === "string" && data.coverUploadId ? [data.coverUploadId] : [];
                const covers = await claimUploads(tx, coverIds, userId, "COURSE_COVER");
                updateData.coverStoredFileId = covers[0]?.id ?? null;
                if (course.coverStoredFileId && course.coverStoredFileId !== covers[0]?.id) replacedCoverIds = [course.coverStoredFileId];
                await markFilesForDeletion(tx, replacedCoverIds);
            }
            return tx.course.update({ where: { id: courseId }, data: updateData });
        });
        await purgeStoredFiles(replacedCoverIds);

        const activityType = isPublishRequest && !course.published ? "COURSE_PUBLISHED" : "COURSE_UPDATED";
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
        if (e instanceof UploadClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof CoursePublishAuditUnavailableError) {
            return NextResponse.json({ error: e.message, code: "COURSE_PUBLISH_CHECK_UNAVAILABLE" }, { status: 503 });
        }
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

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: {
                createdById: true, coverStoredFileId: true,
                files: { select: { storedFileId: true } },
                modules: { select: { lessons: { select: { files: { select: { storedFileId: true } } } } } },
            },
        }) as DeleteCourseRecord | null;
        if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!await canManageCourse(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const storedFileIds = [
            ...(course.coverStoredFileId ? [course.coverStoredFileId] : []),
            ...course.files.flatMap((file) => file.storedFileId ? [file.storedFileId] : []),
            ...course.modules.flatMap((courseModule) => courseModule.lessons.flatMap((lesson) => lesson.files.flatMap((file) => file.storedFileId ? [file.storedFileId] : []))),
        ];
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await markFilesForDeletion(tx, storedFileIds);
            await tx.course.delete({ where: { id: courseId } });
        });
        await purgeStoredFiles(storedFileIds);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/courses/[courseId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
