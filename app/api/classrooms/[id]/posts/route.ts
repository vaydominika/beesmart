import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

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

        // Only teachers/TAs can create certain post types
        const teacherOnlyTypes = ["ASSIGNMENT", "TEST", "COURSE", "MATERIAL"];
        if (teacherOnlyTypes.includes(type) && membership.role === "STUDENT") {
            return NextResponse.json({ error: "Students cannot create this type of post" }, { status: 403 });
        }

        const post = await prisma.classroomPost.create({
            data: {
                classroomId: id,
                authorId: userId,
                type: type || "TEXT",
                title: title?.trim() || null,
                content: content?.trim() || null,
                isPinned: isPinned || false,
                assignmentId: data.assignmentId || null,
                testId: data.testId || null,
                courseId: data.courseId || null,
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

        return NextResponse.json(post, { status: 201 });
    } catch (e) {
        console.error("POST /api/classrooms/[id]/posts", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
