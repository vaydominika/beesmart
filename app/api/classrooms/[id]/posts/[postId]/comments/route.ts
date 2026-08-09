import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; postId: string }> };

// GET /api/classrooms/[id]/posts/[postId]/comments — List comments
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, postId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const post = await prisma.classroomPost.findFirst({ where: { id: postId, classroomId: id }, select: { id: true } });
        if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

        const comments = await prisma.comment.findMany({
            where: { postId: post.id, parentId: null, isPrivate: false },
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
        });

        return NextResponse.json(comments);
    } catch (e) {
        console.error("GET comments", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/posts/[postId]/comments — Add comment/reply
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, postId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const post = await prisma.classroomPost.findFirst({ where: { id: postId, classroomId: id }, select: { id: true } });
        if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

        const { content, parentId } = await req.json();
        if (typeof content !== "string" || !content.trim()) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        if (content.trim().length > 5000) return NextResponse.json({ error: "Comment is too long" }, { status: 400 });

        if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
            return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
        }
        if (parentId) {
            const parent = await prisma.comment.findFirst({
                where: { id: parentId, postId: post.id, submissionId: null, isPrivate: false, parentId: null },
                select: { id: true },
            });
            if (!parent) return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
        }

        const comment = await prisma.comment.create({
            data: {
                post: { connect: { id: post.id } },
                author: { connect: { id: userId } },
                content: content.trim(),
                isPrivate: false,
                ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } },
            },
        });

        return NextResponse.json(comment, { status: 201 });
    } catch (e) {
        console.error("POST comment", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
