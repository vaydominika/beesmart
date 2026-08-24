import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { DeadlineValidationError, parseAssignmentDeadline } from "@/lib/assignment-deadline";
import type { Prisma } from "@/lib/generated/prisma";
import { claimUploads, UploadClaimError } from "@/lib/files/lifecycle";
import { sanitizeRichTextHtml } from "@/lib/security/rich-text";
import { storedFileUrl } from "@/lib/files/types";
import { ScheduleValidationError, assertDeadlineNotPast } from "@/lib/schedule-validation";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/classrooms/[id]/assignments — Create assignment
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can create assignments" }, { status: 403 });
        }

        const {
            title, description, dueDate, dueTime, timeZone,
            isGraded = true, maxPoints, assignedToId, uploadIds: rawUploadIds,
        } = await req.json();
        const uploadIds = Array.isArray(rawUploadIds) ? rawUploadIds : [];

        if (!title?.trim() || !dueDate) {
            return NextResponse.json({ error: "Title and due date required" }, { status: 400 });
        }
        const deadline = parseAssignmentDeadline({ dueDate, dueTime, timeZone });
        assertDeadlineNotPast(deadline.deadlineAt, "Assignment deadline");

        const { assignment, post } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const files = await claimUploads(tx, uploadIds, userId, "POST_ATTACHMENT");
          const assignment = await tx.assignedWork.create({ data: {
                title: title.trim(),
                description: description?.trim() || null,
                assignedById: userId,
                assignedToId: assignedToId || null,
                classroomId: id,
                ...deadline,
                isGraded,
                maxPoints: maxPoints ? parseFloat(maxPoints) : null,
            } });

          const post = await tx.classroomPost.create({
            data: {
                classroomId: id,
                authorId: userId,
                type: "ASSIGNMENT",
                title: title.trim(),
                content: description?.trim() ? sanitizeRichTextHtml(description.trim()) : null,
                assignmentId: assignment.id,
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
            include: {
                author: { select: { id: true, name: true, avatar: true } },
                _count: { select: { comments: true, files: true } },
                files: true,
                assignment: true,
            },
          });
          return { assignment, post };
        });

        // Create event for calendar integration
        await prisma.event.create({
            data: {
                title: `Assignment: ${title.trim()}`,
                description: description?.trim() || null,
                startDate: deadline.deadlineAt,
                endDate: deadline.deadlineAt,
                startTime: dueTime || null,
                endTime: dueTime || null,
                isAllDay: !dueTime,
                isProtected: true,
                classroomId: id,
                assignmentId: assignment.id,
            },
        });

        await notifyClassroomMembers({
            classroomId: id, actorId: userId, title: "New assignment", body: title.trim(),
            type: "ASSIGNMENT", relatedId: assignment.id, relatedType: "assignment",
            actionUrl: `/classroom/${id}/assignments/${assignment.id}`,
        });
        await recordMeaningfulActivity({
            userId, activityType: "ASSIGNMENT_CREATED", classroomId: id, relatedId: assignment.id,
            dedupeKey: `assignment:create:${assignment.id}`,
        });

        return NextResponse.json({ ...post, files: post.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) }, { status: 201 });
    } catch (e) {
        if (e instanceof UploadClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof DeadlineValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }
        if (e instanceof ScheduleValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
        console.error("POST assignment", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
