import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

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
            return NextResponse.json(submission ? [submission] : []);
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

            return NextResponse.json({ submissions, notSubmitted });
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

        const { content, files } = await req.json();

        // Check if assignment exists
        const assignment = await prisma.assignedWork.findUnique({ where: { id: assignmentId } });
        if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

        // Check if late
        const isLate = new Date() > new Date(assignment.dueDate);
        const status = isLate ? "LATE" : "SUBMITTED";

        // Upsert submission
        const submission = await prisma.submission.upsert({
            where: { assignedWorkId_userId: { assignedWorkId: assignmentId, userId } },
            update: {
                content: content?.trim() || null,
                status,
                submittedAt: new Date(),
                files: files?.length
                    ? {
                        deleteMany: {},
                        create: files.map((f: { fileName: string; fileUrl: string; fileType: string; fileSize: number }) => ({
                            fileName: f.fileName,
                            fileUrl: f.fileUrl,
                            fileType: f.fileType,
                            fileSize: f.fileSize,
                        })),
                    }
                    : undefined,
            },
            create: {
                assignedWorkId: assignmentId,
                userId,
                content: content?.trim() || null,
                status,
                submittedAt: new Date(),
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
            include: { files: true },
        });

        return NextResponse.json(submission);
    } catch (e) {
        console.error("POST submission", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
