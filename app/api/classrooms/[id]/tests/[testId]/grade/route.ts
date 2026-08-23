import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomUser } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";
import type { Prisma } from "@/lib/generated/prisma";
import { calculateAttemptTotals } from "@/lib/test-scoring";

type RouteContext = { params: Promise<{ id: string; testId: string }> };
type GradingResponse = {
    id: string;
    pointsAwarded: number | null;
    question: { id: string; points: number; questionType: string };
};
type GradingAttempt = {
    id: string;
    userId: string;
    isCompleted: boolean;
    responses: GradingResponse[];
    test: { questions: Array<{ id: string; points: number }> };
};

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

        const { attemptId, grades } = await req.json() as {
            attemptId?: string;
            grades?: Array<{ responseId: string; pointsAwarded: number | string; teacherComment?: string }>;
        };

        if (!attemptId || !Array.isArray(grades) || grades.length === 0) {
            return NextResponse.json({ error: "Attempt ID and grades required" }, { status: 400 });
        }
        if (grades.some((grade) => typeof grade.responseId !== "string" || (grade.teacherComment != null && typeof grade.teacherComment !== "string"))) {
            return NextResponse.json({ error: "Invalid grade payload" }, { status: 400 });
        }
        if (new Set(grades.map((grade) => grade.responseId)).size !== grades.length) {
            return NextResponse.json({ error: "Each response can only be graded once" }, { status: 400 });
        }

        const attemptBefore = await prisma.testAttempt.findFirst({
            where: { id: attemptId, testId, test: { classroomId: id } },
            include: {
                test: { include: { questions: { select: { id: true, points: true } } } },
                responses: { include: { question: { select: { id: true, points: true, questionType: true } } } },
            },
        });
        if (!attemptBefore) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
        const gradingAttempt = attemptBefore as unknown as GradingAttempt;
        if (!gradingAttempt.isCompleted) return NextResponse.json({ error: "Only completed attempts can be graded" }, { status: 400 });

        const responseById = new Map(gradingAttempt.responses.map((response) => [response.id, response]));
        const parsedGrades = grades.map((grade) => {
            const response = responseById.get(grade.responseId);
            if (!response) throw new Error("INVALID_RESPONSE");
            if (response.question.questionType !== "SHORT_ANSWER" && response.question.questionType !== "ESSAY") {
                throw new Error("OBJECTIVE_RESPONSE");
            }
            const pointsAwarded = typeof grade.pointsAwarded === "number"
                ? grade.pointsAwarded
                : Number.parseFloat(grade.pointsAwarded);
            if (!Number.isFinite(pointsAwarded) || pointsAwarded < 0 || pointsAwarded > response.question.points) {
                throw new Error("INVALID_POINTS");
            }
            const teacherComment = grade.teacherComment?.trim() || null;
            if (teacherComment && teacherComment.length > 1000) throw new Error("COMMENT_TOO_LONG");
            return { response, pointsAwarded, teacherComment };
        });

        const manualResponses = gradingAttempt.responses.filter((response) =>
            response.question.questionType === "SHORT_ANSWER" || response.question.questionType === "ESSAY"
        );
        const submittedGradeIds = new Set(parsedGrades.map(({ response }) => response.id));
        const stillUngraded = manualResponses.some((response) => response.pointsAwarded == null && !submittedGradeIds.has(response.id));
        if (stillUngraded) return NextResponse.json({ error: "Grade every manual response before saving" }, { status: 400 });

        const updatedPoints = new Map(parsedGrades.map(({ response, pointsAwarded }) => [response.id, pointsAwarded]));
        const responsePoints = gradingAttempt.responses.map((response) => ({
            questionId: response.question.id,
            pointsAwarded: updatedPoints.get(response.id) ?? response.pointsAwarded ?? 0,
        }));
        const { totalPoints, totalScore, percentage } = calculateAttemptTotals(gradingAttempt.test.questions, responsePoints);

        const attempt = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const { response, pointsAwarded, teacherComment } of parsedGrades) {
                await tx.testAttemptResponse.update({
                    where: { id: response.id },
                    data: {
                        pointsAwarded,
                        isCorrect: pointsAwarded === response.question.points,
                        teacherComment,
                        aiSuggestedPoints: null,
                        aiSuggestedFeedback: null,
                        aiSuggestedConfidence: null,
                        aiSuggestedAt: null,
                    },
                });
            }
            return tx.testAttempt.update({
                where: { id: attemptId },
                data: { score: percentage },
            });
        });

        // Notify student
        const test = await prisma.test.findUnique({
            where: { id: testId },
            select: { title: true },
        });

        await notifyClassroomUser(attempt.userId, {
            classroomId: id, actorId: userId, title: "Test graded",
            body: `Your ${test?.title} was graded: ${Math.round((attempt.score ?? 0) * 10) / 10}%`,
            type: "GRADE", relatedId: testId, relatedType: "test",
            actionUrl: `/classroom/${id}/tests/${testId}`,
        });
        await recordMeaningfulActivity({
            userId, activityType: "GRADE_PROVIDED", classroomId: id, relatedId: attemptId,
            dedupeKey: `test:grade:${attemptId}:${createHash("sha1").update(JSON.stringify(grades)).digest("hex")}`,
        });

        return NextResponse.json({ attempt, totalScore, totalPoints, gradingStatus: "GRADED" });
    } catch (e) {
        if (e instanceof Error) {
            const validationErrors: Record<string, string> = {
                INVALID_RESPONSE: "A response does not belong to this attempt",
                OBJECTIVE_RESPONSE: "Automatic responses cannot be manually graded here",
                INVALID_POINTS: "Points must be between zero and the question maximum",
                COMMENT_TOO_LONG: "Comments must be 1000 characters or fewer",
            };
            if (validationErrors[e.message]) return NextResponse.json({ error: validationErrors[e.message] }, { status: 400 });
        }
        console.error("POST grade test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
