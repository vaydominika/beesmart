import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { FileType } from "@/lib/generated/prisma";
import { accessibleCourseWhere, classroomCourseAccessWhere } from "@/lib/course-access";
import { recordMeaningfulActivity } from "@/lib/activity";
import { CourseSummary, dedupeClassrooms } from "@/lib/course-summary";

type CourseQueryRecord = {
    id: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
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

type UploadedCourseFile = {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
};

// Helper to map standard mime types to our Prisma enum
const mapToFileType = (mimeType: string): FileType => {
    if (!mimeType) return FileType.OTHER;
    if (mimeType.includes("pdf")) return FileType.PDF;
    if (mimeType.includes("image")) return FileType.IMAGE;
    if (mimeType.includes("video")) return FileType.VIDEO;
    if (mimeType.includes("audio")) return FileType.AUDIO;
    if (mimeType.includes("word") || mimeType.includes("document")) return FileType.DOCUMENT;
    return FileType.OTHER;
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
                coverImageUrl: course.coverImageUrl,
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

        const data = await req.json();
        const { title, description, classroomId, isPublic, coverImageUrl, files, published } = data;
        const visibility = ["PRIVATE", "PUBLIC", "INVITATION_ONLY"].includes(data.visibility)
            ? data.visibility
            : (isPublic ? "PUBLIC" : "PRIVATE");

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const course = await prisma.course.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                classroomId: classroomId || null,
                isPublic: visibility === "PUBLIC",
                visibility,
                published: published || false,
                coverImageUrl: coverImageUrl || null,
                createdById: userId,
                ...(files && files.length > 0 && {
                    files: {
                        create: (files as UploadedCourseFile[]).map((f) => ({
                            fileName: f.fileName,
                            fileUrl: f.fileUrl,
                            fileSize: f.fileSize,
                            fileType: mapToFileType(f.fileType),
                            uploadedById: userId,
                        }))
                    }
                })
            },
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
        console.error("POST /api/courses", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
