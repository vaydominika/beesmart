import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomUser } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";

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

        const assignment = await prisma.assignedWork.findFirst({
            where: { id: assignmentId, classroomId: id },
            select: { title: true, isGraded: true, maxPoints: true },
        });
        if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        if (!assignment.isGraded) {
            return NextResponse.json({ error: "This assignment is not graded" }, { status: 400 });
        }
        if (assignment.maxPoints == null) {
            return NextResponse.json({ error: "Graded assignments require maximum points" }, { status: 400 });
        }

        const { studentId, score, feedback } = await req.json();
        if (!studentId || score === undefined) {
            return NextResponse.json({ error: "Student ID and score required" }, { status: 400 });
        }
        const parsedScore = Number(score);
        if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > assignment.maxPoints) {
            return NextResponse.json({ error: `Score must be between 0 and ${assignment.maxPoints}` }, { status: 400 });
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
                    score: parsedScore,
                    maxScore: assignment.maxPoints,
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
                    score: parsedScore,
                    maxScore: assignment.maxPoints,
                    feedback: feedback?.trim() || null,
                    gradedById: userId,
                    gradedAt: new Date(),
                },
            });
        }

        await notifyClassroomUser(studentId, {
            classroomId: id, actorId: userId, title: "Assignment graded",
            body: `Your submission for "${assignment.title}" was graded: ${parsedScore}/${assignment.maxPoints}`,
            type: "GRADE", relatedId: assignmentId, relatedType: "assignment",
            actionUrl: `/classroom/${id}/assignments/${assignmentId}`,
        });
        await recordMeaningfulActivity({
            userId, activityType: "GRADE_PROVIDED", classroomId: id, relatedId: grade.id,
            dedupeKey: `assignment:grade:${grade.id}:${createHash("sha1").update(JSON.stringify({ score: parsedScore, maxScore: assignment.maxPoints, feedback })).digest("hex")}`,
        });

        return NextResponse.json(grade);
    } catch (e) {
        console.error("POST grade", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
