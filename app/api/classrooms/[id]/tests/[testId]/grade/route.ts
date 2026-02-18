import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

// POST /api/classrooms/[id]/tests/[testId]/grade — Teacher grades/comments on answers
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, testId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can grade" }, { status: 403 });
        }

        const { attemptId, grades } = await req.json();
        // grades: [{ responseId, pointsAwarded, isCorrect, teacherComment }]

        if (!attemptId || !grades?.length) {
            return NextResponse.json({ error: "Attempt ID and grades required" }, { status: 400 });
        }

        let totalScore = 0;
        let totalPoints = 0;

        // Update each response
        for (const g of grades) {
            await prisma.testAttemptResponse.update({
                where: { id: g.responseId },
                data: {
                    pointsAwarded: g.pointsAwarded !== undefined ? parseFloat(g.pointsAwarded) : undefined,
                    isCorrect: g.isCorrect !== undefined ? g.isCorrect : undefined,
                    teacherComment: g.teacherComment?.trim() || null,
                },
            });
        }

        // Recalculate total score
        const allResponses = await prisma.testAttemptResponse.findMany({
            where: { attemptId },
            include: { question: true },
        });

        for (const r of allResponses) {
            totalPoints += (r as any).question.points;
            totalScore += (r as any).pointsAwarded || 0;
        }

        // Update attempt score
        const attempt = await prisma.testAttempt.update({
            where: { id: attemptId },
            data: {
                score: totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0,
            },
        });

        // Notify student
        const test = await prisma.test.findUnique({
            where: { id: testId },
            select: { title: true },
        });

        await prisma.notification.create({
            data: {
                userId: attempt.userId,
                title: "Test Graded",
                body: `Your ${test?.title} has been graded: ${Math.round((attempt.score ?? 0) * 10) / 10}%`,
                type: "GRADE",
                relatedId: testId,
                relatedType: "test",
            },
        });

        return NextResponse.json({ attempt, totalScore, totalPoints });
    } catch (e) {
        console.error("POST grade test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
