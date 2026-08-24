import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { richTextToPlainText, sanitizeRichTextHtml } from "@/lib/security/rich-text";
import { markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";
import type { Prisma } from "@/lib/generated/prisma";
import { notifyClassroomMembers } from "@/lib/notifications";

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

        return NextResponse.json({ ...post, files: (post.files ?? []).map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })), isOwnPost: post.author.id === userId });
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

        const post = await prisma.classroomPost.findUnique({
            where: { id: postId },
            include: { _count: { select: { files: true } } },
        });
        if (!post || post.classroomId !== id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const data = await req.json();
        const updateData: Record<string, unknown> = {};
        const editsContent = data.title !== undefined || data.content !== undefined;
        if (editsContent && post.authorId !== userId) {
            return NextResponse.json({ error: "Only the author can edit this post" }, { status: 403 });
        }

        if (data.title !== undefined) {
            updateData.title = typeof data.title === "string" ? data.title.trim() || null : null;
        }
        if (data.content !== undefined) {
            const sanitized = sanitizeRichTextHtml(data.content);
            updateData.content = richTextToPlainText(sanitized) ? sanitized : null;
        }
        if (data.isPinned !== undefined && membership.role === "TEACHER") {
            updateData.isPinned = Boolean(data.isPinned);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        if (editsContent) {
            const nextTitle = data.title !== undefined ? updateData.title : post.title;
            const nextContent = data.content !== undefined ? updateData.content : post.content;
            const plainText = richTextToPlainText(nextContent);
            const hasAttachment = Boolean(post.assignmentId || post.testId || post.courseId || post._count.files);
            if (!nextTitle && !plainText && !hasAttachment) {
                return NextResponse.json({ error: "A post without attachments needs text" }, { status: 400 });
            }
        }

        const contentChanged = editsContent && (
            (data.title !== undefined && updateData.title !== post.title)
            || (data.content !== undefined && updateData.content !== post.content)
        );
        if (contentChanged) updateData.editedAt = new Date();

        const updated = await prisma.classroomPost.update({
            where: { id: postId },
            data: updateData,
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                _count: { select: { comments: true, files: true } },
                files: true,
            },
        });

        if (contentChanged) {
            await notifyClassroomMembers({
                classroomId: id,
                actorId: userId,
                title: "Post updated",
                body: updated.title ? `${updated.title} was edited.` : "A classroom post was edited.",
                type: "OTHER",
                relatedId: postId,
                relatedType: "post",
                actionUrl: `/classroom/${id}?post=${postId}`,
                recipientRoles: ["STUDENT"],
            });
        }

        return NextResponse.json({ ...updated, files: (updated.files ?? []).map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) });
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

        const post = await prisma.classroomPost.findUnique({ where: { id: postId }, include: { files: { select: { storedFileId: true } } } });
        if (!post || post.classroomId !== id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (post.authorId !== userId && membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const storedFileIds = (post.files ?? []).flatMap((file: any) => file.storedFileId ? [file.storedFileId] : []);
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await markFilesForDeletion(tx, storedFileIds);
            await tx.classroomPost.delete({ where: { id: postId } });
        });
        await purgeStoredFiles(storedFileIds);
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE /api/classrooms/[id]/posts/[postId]", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
