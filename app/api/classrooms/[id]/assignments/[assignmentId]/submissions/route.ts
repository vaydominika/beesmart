import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import type { Prisma } from "@/lib/generated/prisma";
import { claimUploads, markFilesForDeletion, purgeStoredFiles, UploadClaimError } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

// GET /api/classrooms/[id]/assignments/[assignmentId]/submissions
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, assignmentId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        if (membership.role === "STUDENT") {
            // Student can only view their own submission
            const submission = await prisma.submission.findUnique({
                where: { assignedWorkId_userId: { assignedWorkId: assignmentId, userId } },
                include: {
                    files: true,
                    comments: {
                        where: { isPrivate: true },
                        include: { author: { select: { id: true, name: true, avatar: true } } },
                        orderBy: { createdAt: "asc" },
                    },
                },
            });
            return NextResponse.json(submission ? [{ ...submission, files: submission.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) }] : []);
        } else {
            // Teacher/TA can view all submissions
            const submissions = await prisma.submission.findMany({
                where: { assignedWorkId: assignmentId },
                include: {
                    user: { select: { id: true, name: true, email: true, avatar: true } },
                    files: true,
                    _count: { select: { comments: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            // Also get students who haven't submitted
            const allStudents = await prisma.classroomMember.findMany({
                where: { classroomId: id, role: "STUDENT" },
                include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            });

            const submittedIds = new Set(submissions.map((s: any) => s.userId));
            const notSubmitted = allStudents
                .filter((m: any) => !submittedIds.has(m.userId))
                .map((m: any) => ({
                    user: m.user,
                    status: "PENDING",
                }));

            return NextResponse.json({ submissions: submissions.map((submission: any) => ({ ...submission, files: submission.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) })), notSubmitted });
        }
    } catch (e) {
        console.error("GET submissions", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/assignments/[assignmentId]/submissions — Submit work
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, assignmentId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const { content, uploadIds: rawUploadIds } = await req.json();
        const uploadIds = Array.isArray(rawUploadIds) ? rawUploadIds : [];

        // Check if assignment exists
        const assignment = await prisma.assignedWork.findFirst({ where: { id: assignmentId, classroomId: id } });
        if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

        const submittedAt = new Date();
        const isLate = submittedAt.getTime() > assignment.deadlineAt.getTime();
        const status = isLate ? "LATE" : "SUBMITTED";

        const existing = await prisma.submission.findUnique({
            where: { assignedWorkId_userId: { assignedWorkId: assignmentId, userId } },
            select: { files: { select: { storedFileId: true } } },
        });
        const oldStoredFileIds = existing?.files.flatMap((file: any) => file.storedFileId ? [file.storedFileId] : []) ?? [];

        const submission = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const files = await claimUploads(tx, uploadIds, userId, "SUBMISSION_ATTACHMENT");
          await markFilesForDeletion(tx, oldStoredFileIds);
          return tx.submission.upsert({
            where: { assignedWorkId_userId: { assignedWorkId: assignmentId, userId } },
            update: {
                content: content?.trim() || null,
                status,
                submittedAt,
                files: {
                        deleteMany: {},
                        create: files.map((f) => ({
                            fileName: f.originalName,
                            storedFileId: f.id,
                            fileType: f.fileType,
                            fileSize: f.size,
                        })),
                    },
            },
            create: {
                assignedWorkId: assignmentId,
                userId,
                content: content?.trim() || null,
                status,
                submittedAt,
                files: files.length
                    ? {
                        create: files.map((f) => ({
                            fileName: f.originalName,
                            storedFileId: f.id,
                            fileType: f.fileType,
                            fileSize: f.size,
                        })),
                    }
                    : undefined,
            },
            include: { files: true },
          });
        });
        await purgeStoredFiles(oldStoredFileIds);

        await recordMeaningfulActivity({
            userId, activityType: "ASSIGNMENT_SUBMITTED", classroomId: id, relatedId: assignmentId,
            dedupeKey: `assignment:submit:${assignmentId}:${userId}`,
        });

        return NextResponse.json({ ...submission, files: submission.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) });
    } catch (e) {
        if (e instanceof UploadClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
        console.error("POST submission", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
