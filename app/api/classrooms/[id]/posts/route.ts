import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { canAccessCourse } from "@/lib/course-access";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id]/posts — List posts with search/filter/sort
export async function GET(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const url = new URL(req.url);
        const search = url.searchParams.get("search") || "";
        const type = url.searchParams.get("type") || "";
        const sort = url.searchParams.get("sort") || "newest";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");

        const where: Record<string, unknown> = { classroomId: id };
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { content: { contains: search } },
                { author: { name: { contains: search } } },
            ];
        }

        const [posts, total] = await Promise.all([
            prisma.classroomPost.findMany({
                where,
                include: {
                    author: { select: { id: true, name: true, avatar: true } },
                    _count: { select: { comments: true, files: true } },
                    files: true,
                    assignment: {
                        select: {
                            id: true, title: true, dueDate: true, dueTime: true,
                            isGraded: true, maxPoints: true, isCompleted: true,
                            _count: { select: { submissions: true } },
                        },
                    },
                    test: {
                        select: {
                            id: true, title: true, type: true, timeLimit: true,
                            opensAt: true, closesAt: true, passingScore: true,
                        },
                    },
                    course: {
                        select: {
                            id: true, title: true, description: true, visibility: true, coverImageUrl: true,
                            creator: { select: { name: true } },
                            _count: { select: { modules: true } },
                        },
                    },
                },
                orderBy: [
                    { isPinned: "desc" },
                    { createdAt: sort === "oldest" ? "asc" : "desc" },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.classroomPost.count({ where }),
        ]);

        return NextResponse.json({ posts, total, page, limit });
    } catch (e) {
        console.error("GET /api/classrooms/[id]/posts", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/posts — Create a post
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const data = await req.json();
        const { type, title, content, isPinned, files } = data;
        const courseId = typeof data.courseId === "string" && data.courseId ? data.courseId : null;
        const normalizedType = courseId ? "COURSE" : (type || "TEXT");

        // Only teachers/TAs can create certain post types
        const teacherOnlyTypes = ["ASSIGNMENT", "TEST", "COURSE"];
        if (teacherOnlyTypes.includes(normalizedType) && membership.role === "STUDENT") {
            return NextResponse.json({ error: "Students cannot create this type of post" }, { status: 403 });
        }

        const course = courseId
            ? await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, visibility: true } })
            : null;
        if (courseId && (!course || !await canAccessCourse(courseId, userId))) {
            return NextResponse.json({ error: "Course is not available" }, { status: 403 });
        }
        if (course?.visibility === "PRIVATE") {
            return NextResponse.json({ error: "Private courses cannot be shared. Change the course visibility first." }, { status: 403 });
        }

        const plainText = typeof content === "string" ? content.replace(/<[^>]*>/g, "").trim() : "";
        const hasFiles = Array.isArray(files) && files.length > 0;
        if (!title?.trim() && !plainText && !hasFiles && !courseId) {
            return NextResponse.json({ error: "Write a message, attach a file, or add a course" }, { status: 400 });
        }

        const post = await prisma.classroomPost.create({
            data: {
                classroomId: id,
                authorId: userId,
                type: normalizedType,
                title: title?.trim() || null,
                content: content?.trim() || null,
                isPinned: isPinned || false,
                assignmentId: data.assignmentId || null,
                testId: data.testId || null,
                courseId,
                files: files?.length
                    ? {
                        create: files.map((f: { fileName: string; fileUrl: string; fileType: string; fileSize: number }) => ({
                            fileName: f.fileName,
                            fileUrl: f.fileUrl,
                            fileType: f.fileType,
                            fileSize: f.fileSize,
                        })),
                    }
                    : undefined,
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                _count: { select: { comments: true, files: true } },
                files: true,
            },
        });

        if (courseId && course?.visibility === "INVITATION_ONLY") {
            const members = await prisma.classroomMember.findMany({ where: { classroomId: id }, select: { userId: true } });
            await prisma.courseAccess.createMany({
                data: members.map((member: { userId: string }) => ({ courseId, userId: member.userId, invitedById: userId })),
                skipDuplicates: true,
            });
        }

        const sideEffects = await Promise.allSettled([
            notifyClassroomMembers({
                classroomId: id,
                actorId: userId,
                title: courseId ? "New Classroom course" : hasFiles ? "New Classroom material" : "New Classroom post",
                body: plainText ? plainText.slice(0, 180) : (course?.title || title?.trim() || "A file was shared."),
                type: hasFiles || courseId ? "OTHER" : "ANNOUNCEMENT",
                relatedId: post.id,
                relatedType: "post",
                actionUrl: `/classroom/${id}`,
            }),
            recordMeaningfulActivity({
                userId,
                activityType: courseId ? "CLASSROOM_COURSE_PUBLISHED" : hasFiles ? "MATERIAL_UPLOADED" : "CLASSROOM_POST_PUBLISHED",
                classroomId: id,
                courseId,
                relatedId: post.id,
                dedupeKey: `classroom:post:${post.id}`,
            }),
        ]);
        sideEffects.forEach((result) => {
            if (result.status === "rejected") console.error("Classroom post side effect failed", result.reason);
        });

        return NextResponse.json(post, { status: 201 });
    } catch (e) {
        console.error("POST /api/classrooms/[id]/posts", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
