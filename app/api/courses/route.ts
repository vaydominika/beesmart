import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { FileType } from "@/lib/generated/prisma";

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
export async function GET() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const courses = await prisma.course.findMany({
            where: {
                OR: [
                    { createdById: userId },
                    { enrollments: { some: { userId } } },
                ]
            },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                _count: { select: { modules: true, enrollments: true } },
                modules: { include: { lessons: { select: { id: true } } } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Get progress for all these courses
        const courseIds = courses.map((c: any) => c.id);
        const userProgress = await prisma.courseProgress.findMany({
            where: { userId, courseId: { in: courseIds } },
            select: { lessonId: true, completedAt: true, courseId: true }
        });

        const completedLessonIds = new Set(
            userProgress
                .filter((p: any) => p.completedAt != null)
                .map((p: any) => p.lessonId)
        );

        const coursesWithProgress = courses.map((course: any) => {
            const totalLessons = course.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);
            let progress = 0;
            if (totalLessons > 0) {
                const completed = course.modules.reduce(
                    (acc: number, m: any) => acc + m.lessons.filter((l: any) => completedLessonIds.has(l.id)).length,
                    0
                );
                progress = Math.round((completed / totalLessons) * 100);
            }

            return {
                ...course,
                progress
            };
        });

        return NextResponse.json(coursesWithProgress);
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

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        const course = await prisma.course.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                classroomId: classroomId || null,
                isPublic: isPublic || false,
                published: published || false,
                coverImageUrl: coverImageUrl || null,
                createdById: userId,
                ...(files && files.length > 0 && {
                    files: {
                        create: files.map((f: any) => ({
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

        return NextResponse.json(course);
    } catch (e) {
        console.error("POST /api/courses", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
