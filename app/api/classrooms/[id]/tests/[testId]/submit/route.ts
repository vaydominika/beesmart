import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

// POST /api/classrooms/[id]/tests/[testId]/submit — Submit test answers
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, testId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const { attemptId, responses } = await req.json();
        if (!attemptId || !responses?.length) {
            return NextResponse.json({ error: "Attempt ID and responses required" }, { status: 400 });
        }

        const attempt = await prisma.testAttempt.findUnique({
            where: { id: attemptId },
        });
        if (!attempt || attempt.userId !== userId || attempt.isCompleted) {
            return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
        }

        // Check time limit
        const test = await prisma.test.findUnique({ where: { id: testId } });
        if (test?.timeLimit) {
            const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000 / 60;
            if (elapsed > test.timeLimit + 1) { // 1 min grace
                return NextResponse.json({ error: "Time limit exceeded" }, { status: 400 });
            }
        }

        // Get questions with correct answers for auto-grading
        const questions = await prisma.testQuestion.findMany({
            where: { testId },
            include: {
                options: true,
                answers: true,
            },
        });

        const questionMap = new Map(questions.map((q: any) => [q.id, q]));
        let totalScore = 0;
        let totalPoints = 0;

        // Create response records
        for (const response of responses) {
            const question: any = questionMap.get(response.questionId);
            if (!question) continue;

            totalPoints += question.points;
            let isCorrect: boolean | null = null;
            let pointsAwarded: number | null = null;

            if (question.questionType === "MULTIPLE_CHOICE" || question.questionType === "TRUE_FALSE") {
                // Auto-grade
                const correctOption = question.options.find((o: any) => o.isCorrect);
                isCorrect = response.selectedOptionId === correctOption?.id;
                pointsAwarded = isCorrect ? question.points : 0;
                totalScore += pointsAwarded ?? 0;
            }
            // SHORT_ANSWER and ESSAY need manual grading

            await prisma.testAttemptResponse.create({
                data: {
                    attemptId,
                    questionId: response.questionId,
                    responseText: response.responseText || null,
                    selectedOptionId: response.selectedOptionId || null,
                    isCorrect,
                    pointsAwarded,
                },
            });
        }

        // Check if all questions are auto-gradeable
        const hasManualGrading = questions.some(
            (q: any) => q.questionType === "SHORT_ANSWER" || q.questionType === "ESSAY"
        );

        const updated = await prisma.testAttempt.update({
            where: { id: attemptId },
            data: {
                isCompleted: true,
                submittedAt: new Date(),
                score: hasManualGrading ? null : (totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0),
            },
        });

        return NextResponse.json({
            attempt: updated,
            score: totalScore,
            totalPoints,
            needsManualGrading: hasManualGrading,
        });
    } catch (e) {
        console.error("POST submit test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
