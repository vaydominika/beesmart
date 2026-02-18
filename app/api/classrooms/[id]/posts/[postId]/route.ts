import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; postId: string }> };

// GET /api/classrooms/[id]/posts/[postId] — Get single post
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, postId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const post = await prisma.classroomPost.findUnique({
            where: { id: postId },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                files: true,
                _count: { select: { comments: true } },
                assignment: {
                    include: {
                        _count: { select: { submissions: true } },
                    },
                },
                test: {
                    include: {
                        _count: { select: { questions: true, attempts: true } },
                    },
                },
                comments: {
                    where: { parentId: null, isPrivate: false },
                    include: {
                        author: { select: { id: true, name: true, avatar: true } },
                        replies: {
                            include: {
                                author: { select: { id: true, name: true, avatar: true } },
                            },
                            orderBy: { createdAt: "asc" },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
            },
        });

        if (!post || post.classroomId !== id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(post);
    } catch (e) {
        console.error("GET /api/classrooms/[id]/posts/[postId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/classrooms/[id]/posts/[postId] — Edit/pin post
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, postId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const post = await prisma.classroomPost.findUnique({ where: { id: postId } });
        if (!post || post.classroomId !== id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Only author or teacher can edit
        if (post.authorId !== userId && membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const data = await req.json();
        const updateData: Record<string, unknown> = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.isPinned !== undefined && membership.role === "TEACHER") {
            updateData.isPinned = data.isPinned;
        }

        const updated = await prisma.classroomPost.update({
            where: { id: postId },
            data: updateData,
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                _count: { select: { comments: true, files: true } },
                files: true,
            },
        });

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH /api/classrooms/[id]/posts/[postId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id]/posts/[postId] — Delete post
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, postId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const post = await prisma.classroomPost.findUnique({ where: { id: postId } });
        if (!post || post.classroomId !== id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (post.authorId !== userId && membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        await prisma.classroomPost.delete({ where: { id: postId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/classrooms/[id]/posts/[postId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
