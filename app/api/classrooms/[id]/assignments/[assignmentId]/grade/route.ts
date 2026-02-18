import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

// POST /api/classrooms/[id]/assignments/[assignmentId]/grade — Grade a submission
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, assignmentId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can grade" }, { status: 403 });
        }

        const { studentId, score, maxScore, feedback } = await req.json();
        if (!studentId || score === undefined) {
            return NextResponse.json({ error: "Student ID and score required" }, { status: 400 });
        }

        // Update submission status
        await prisma.submission.updateMany({
            where: { assignedWorkId: assignmentId, userId: studentId },
            data: { status: "GRADED" },
        });

        // Create/update grade
        const existingGrade = await prisma.grade.findFirst({
            where: { assignedWorkId: assignmentId, userId: studentId },
        });

        let grade;
        if (existingGrade) {
            grade = await prisma.grade.update({
                where: { id: existingGrade.id },
                data: {
                    score: parseFloat(score),
                    maxScore: maxScore ? parseFloat(maxScore) : null,
                    feedback: feedback?.trim() || null,
                    gradedById: userId,
                    gradedAt: new Date(),
                },
            });
        } else {
            grade = await prisma.grade.create({
                data: {
                    userId: studentId,
                    assignedWorkId: assignmentId,
                    score: parseFloat(score),
                    maxScore: maxScore ? parseFloat(maxScore) : null,
                    feedback: feedback?.trim() || null,
                    gradedById: userId,
                    gradedAt: new Date(),
                },
            });
        }

        // Notify student
        const assignment = await prisma.assignedWork.findUnique({
            where: { id: assignmentId },
            select: { title: true },
        });

        await prisma.notification.create({
            data: {
                userId: studentId,
                title: "Assignment Graded",
                body: `Your submission for "${assignment?.title}" has been graded: ${score}${maxScore ? `/${maxScore}` : ""}`,
                type: "GRADE",
                relatedId: assignmentId,
                relatedType: "assignment",
            },
        });

        return NextResponse.json(grade);
    } catch (e) {
        console.error("POST grade", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
