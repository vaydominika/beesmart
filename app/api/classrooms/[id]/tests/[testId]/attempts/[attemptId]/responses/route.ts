import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string; attemptId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id: classroomId, testId, attemptId } = await context.params;
    const membership = await prisma.classroomMember.findUnique({
        where: { userId_classroomId: { userId, classroomId } }, select: { role: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    if (membership.role !== "STUDENT") return NextResponse.json({ error: "Only learners can save responses" }, { status: 403 });

    const body = await request.json() as { questionId?: string; responseText?: unknown; selectedOptionId?: unknown };
    if (!body.questionId || (body.responseText != null && typeof body.responseText !== "string") || (body.selectedOptionId != null && typeof body.selectedOptionId !== "string")) {
        return NextResponse.json({ error: "Invalid response payload" }, { status: 400 });
    }
    const attempt = await prisma.testAttempt.findFirst({
        where: { id: attemptId, testId, userId, isCompleted: false, test: { classroomId } }, select: { id: true },
    });
    if (!attempt) return NextResponse.json({ error: "Active attempt not found" }, { status: 404 });
    const question = await prisma.testQuestion.findFirst({
        where: { id: body.questionId, testId },
        include: { options: { select: { id: true } } },
    });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
    if (body.selectedOptionId && !question.options.some((option: { id: string }) => option.id === body.selectedOptionId)) {
        return NextResponse.json({ error: "The selected option does not belong to this question" }, { status: 400 });
    }

    const saved = await prisma.testAttemptResponse.upsert({
        where: { attemptId_questionId: { attemptId, questionId: body.questionId } },
        update: {
            responseText: typeof body.responseText === "string" ? body.responseText : null,
            selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : null,
            isCorrect: null,
            pointsAwarded: null,
            teacherComment: null,
        },
        create: {
            attemptId,
            questionId: body.questionId,
            responseText: typeof body.responseText === "string" ? body.responseText : null,
            selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : null,
        },
        select: { questionId: true, responseText: true, selectedOptionId: true, createdAt: true },
    });
    return NextResponse.json({ response: saved, savedAt: new Date().toISOString() });
}
