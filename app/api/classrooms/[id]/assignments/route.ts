import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

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
            title, description, dueDate, dueTime,
            isGraded = true, maxPoints, assignedToId, files,
        } = await req.json();

        if (!title?.trim() || !dueDate) {
            return NextResponse.json({ error: "Title and due date required" }, { status: 400 });
        }

        // Create the assigned work
        const assignment = await prisma.assignedWork.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                assignedById: userId,
                assignedToId: assignedToId || null,
                classroomId: id,
                dueDate: new Date(dueDate),
                dueTime: dueTime || null,
                isGraded,
                maxPoints: maxPoints ? parseFloat(maxPoints) : null,
            },
        });

        // Create a post for the feed
        const post = await prisma.classroomPost.create({
            data: {
                classroomId: id,
                authorId: userId,
                type: "ASSIGNMENT",
                title: title.trim(),
                content: description?.trim() || null,
                assignmentId: assignment.id,
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
                assignment: true,
            },
        });

        // Create event for calendar integration
        await prisma.event.create({
            data: {
                title: `Assignment: ${title.trim()}`,
                description: description?.trim() || null,
                startDate: new Date(dueDate),
                endDate: new Date(dueDate),
                startTime: dueTime || null,
                endTime: dueTime || null,
                isAllDay: !dueTime,
                classroomId: id,
                color: (await prisma.classroom.findUnique({ where: { id }, select: { color: true } }))?.color || null,
            },
        });

        // Notify classroom members
        const members = await prisma.classroomMember.findMany({
            where: { classroomId: id },
            select: { userId: true },
        });
        const classroom = await prisma.classroom.findUnique({
            where: { id }, select: { name: true },
        });

        await prisma.notification.createMany({
            data: members
                .filter((m: any) => m.userId !== userId)
                .map((m: any) => ({
                    userId: m.userId,
                    title: `New Assignment in ${classroom?.name}`,
                    body: title.trim(),
                    type: "ASSIGNMENT" as const,
                    relatedId: assignment.id,
                    relatedType: "assignment",
                })),
        });

        return NextResponse.json(post, { status: 201 });
    } catch (e) {
        console.error("POST assignment", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
