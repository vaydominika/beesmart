import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { accessibleCourseWhere, classroomCourseAccessWhere } from "@/lib/course-access";
import { recordMeaningfulActivity } from "@/lib/activity";
import { CourseSummary, dedupeClassrooms } from "@/lib/course-summary";
import { claimUploads, UploadClaimError } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";
import { COURSE_TITLE_MAX_LENGTH, normalizeCourseTitle } from "@/lib/course-title";

type CourseQueryRecord = {
    id: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    coverStoredFileId: string | null;
    createdById: string;
    classroomId: string | null;
    isPublic: boolean;
    published: boolean;
    visibility: CourseSummary["visibility"];
    createdAt: Date;
    updatedAt: Date;
    creator: CourseSummary["creator"];
    _count: CourseSummary["_count"];
    modules: Array<{ lessons: Array<{ id: string }> }>;
    enrollments: Array<{ completedAt: Date | null }>;
    classroom: { id: string; name: string } | null;
    classroomLinks: Array<{ classroom: { id: string; name: string } }>;
};

// GET /api/courses — Get all courses for the current user
export async function GET(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const source = req.nextUrl.searchParams.get("source");
        const search = req.nextUrl.searchParams.get("search")?.trim();
        const sourceWhere = source === "my"
            ? { createdById: userId }
            : source === "all"
                ? accessibleCourseWhere(userId)
                : { OR: [
                    { createdById: userId },
                    { published: true, visibility: { not: "PRIVATE" as const }, enrollments: { some: { userId } } },
                    { visibility: "INVITATION_ONLY" as const, accessGrants: { some: { userId } } },
                    classroomCourseAccessWhere(userId),
                ] };
        const courses = await prisma.course.findMany({
            where: {
                AND: [
                    sourceWhere,
                    ...(search ? [{ OR: [
                        { title: { contains: search } },
                        { description: { contains: search } },
                        { creator: { name: { contains: search } } },
                    ] }] : []),
                ],
            },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                _count: { select: { modules: true, enrollments: true } },
                modules: { include: { lessons: { select: { id: true } } } },
                enrollments: { where: { userId }, select: { completedAt: true } },
                classroom: { select: { id: true, name: true } },
                classroomLinks: { select: { classroom: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Get progress for all these courses
        const courseRecords = courses as CourseQueryRecord[];
        const courseIds = courseRecords.map((course) => course.id);
        const userProgress = await prisma.courseProgress.findMany({
            where: { userId, courseId: { in: courseIds } },
            select: { lessonId: true, completedAt: true, courseId: true, lastAccessedAt: true }
        });

        const progressByCourse = new Map<string, { completedLessonIds: Set<string>; lastAccessedAt: Date | null }>();
        for (const item of userProgress) {
            const current = progressByCourse.get(item.courseId) ?? { completedLessonIds: new Set<string>(), lastAccessedAt: null };
            if (item.completedAt) current.completedLessonIds.add(item.lessonId);
            if (!current.lastAccessedAt || item.lastAccessedAt > current.lastAccessedAt) current.lastAccessedAt = item.lastAccessedAt;
            progressByCourse.set(item.courseId, current);
        }

        const summaries: CourseSummary[] = courseRecords.map((course) => {
            const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);
            const courseProgress = progressByCourse.get(course.id);
            const completedCount = courseProgress?.completedLessonIds.size ?? 0;
            const progress = lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;
            const classrooms = dedupeClassrooms([
                ...(course.classroom ? [course.classroom] : []),
                ...course.classroomLinks.map((link) => link.classroom),
            ]);

            return {
                id: course.id,
                title: course.title,
                description: course.description,
                coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl),
                createdById: course.createdById,
                classroomId: course.classroomId,
                isPublic: course.isPublic,
                published: course.published,
                visibility: course.visibility,
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
                relationship: course.createdById === userId ? "owner" : "learner",
                isEnrolled: course.enrollments.length > 0,
                progress,
                lastAccessedAt: courseProgress?.lastAccessedAt?.toISOString() ?? null,
                lessonCount,
                classrooms,
                creator: course.creator,
                _count: course._count,
            };
        });

        return NextResponse.json(summaries);
    } catch (e) {
        console.error("GET /api/courses", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/courses — Create a new course
export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const settings = await prisma.userSettings.findUnique({
            where: { userId },
            select: { courseCreationTutorialCompleted: true },
        });
        if (!settings?.courseCreationTutorialCompleted) {
            return NextResponse.json({
                error: "Complete the course creation tutorial before creating a course.",
                code: "COURSE_TUTORIAL_REQUIRED",
            }, { status: 403 });
        }

        const data = await req.json();
        const { title, description, classroomId, isPublic, published } = data;
        const visibility = ["PRIVATE", "PUBLIC", "INVITATION_ONLY"].includes(data.visibility)
            ? data.visibility
            : (isPublic ? "PUBLIC" : "PRIVATE");

        const normalizedTitle = normalizeCourseTitle(title);
        if (!normalizedTitle) {
            if (typeof title === "string" && title.trim().length > COURSE_TITLE_MAX_LENGTH) {
                return NextResponse.json({ error: `Course title must be ${COURSE_TITLE_MAX_LENGTH} characters or fewer.` }, { status: 400 });
            }
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const uploadIds = Array.isArray(data.uploadIds) ? data.uploadIds : [];
        const coverUploadIds = typeof data.coverUploadId === "string" ? [data.coverUploadId] : [];
        const course = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const attachments = await claimUploads(tx, uploadIds, userId, "COURSE_ATTACHMENT");
            const covers = await claimUploads(tx, coverUploadIds, userId, "COURSE_COVER");
            return tx.course.create({ data: {
                title: normalizedTitle,
                description: description?.trim() || null,
                classroomId: classroomId || null,
                isPublic: visibility === "PUBLIC",
                visibility,
                published: published || false,
                coverStoredFileId: covers[0]?.id ?? null,
                createdById: userId,
                ...(attachments.length > 0 && {
                    files: {
                        create: attachments.map((file) => ({
                            fileName: file.originalName,
                            fileSize: file.size,
                            fileType: file.fileType,
                            storedFileId: file.id,
                            uploadedById: userId,
                        }))
                    }
                })
            } });
        });

        await recordMeaningfulActivity({
            userId, activityType: "COURSE_CREATED", courseId: course.id, relatedId: course.id,
            dedupeKey: `course:create:${course.id}`,
        });
        await prisma.notification.create({
            data: {
                userId,
                title: "Course created",
                body: `${course.title} is ready for you to build.`,
                type: "OTHER",
                category: "GENERAL",
                relatedId: course.id,
                relatedType: "course",
                actionUrl: `/courses/${course.id}/builder`,
            },
        });

        return NextResponse.json(course);
    } catch (e) {
        if (e instanceof UploadClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
        console.error("POST /api/courses", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
