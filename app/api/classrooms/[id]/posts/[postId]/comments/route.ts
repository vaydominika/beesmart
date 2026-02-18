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

        const comments = await prisma.comment.findMany({
            where: { postId, parentId: null, isPrivate: false },
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

        const { content, parentId } = await req.json();
        if (!content?.trim()) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const comment = await prisma.comment.create({
            data: {
                postId,
                authorId: userId,
                content: content.trim(),
                isPrivate: false,
                parentId: parentId || null,
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
