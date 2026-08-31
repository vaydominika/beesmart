import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import {
    TEST_RESPONSE_REQUEST_BYTE_LIMIT,
    TEST_TOTAL_WRITTEN_CHARACTER_LIMIT,
    totalWrittenCharacters,
    writtenResponseLimit,
} from "@/lib/test-response-limits";

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

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > TEST_RESPONSE_REQUEST_BYTE_LIMIT) {
        return NextResponse.json({ error: "The response payload is too large", code: "RESPONSE_PAYLOAD_TOO_LARGE" }, { status: 413 });
    }

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
    const responseText = typeof body.responseText === "string" ? body.responseText : null;
    const responseLimit = writtenResponseLimit(question.questionType);
    if (responseLimit !== null && (responseText?.length ?? 0) > responseLimit) {
        return NextResponse.json({
            error: `${question.questionType === "ESSAY" ? "Essay" : "Short answer"} responses must be ${responseLimit.toLocaleString()} characters or fewer`,
            code: "RESPONSE_TOO_LONG",
            limit: responseLimit,
        }, { status: 413 });
    }
    if (body.selectedOptionId && !question.options.some((option: { id: string }) => option.id === body.selectedOptionId)) {
        return NextResponse.json({ error: "The selected option does not belong to this question" }, { status: 400 });
    }

    const existingResponses = await prisma.testAttemptResponse.findMany({
        where: { attemptId },
        select: { questionId: true, responseText: true },
    });
    const writtenResponses = existingResponses
        .filter((response) => response.questionId !== body.questionId)
        .concat({ questionId: body.questionId, responseText });
    if (totalWrittenCharacters(writtenResponses) > TEST_TOTAL_WRITTEN_CHARACTER_LIMIT) {
        return NextResponse.json({
            error: `Written responses for one attempt must total ${TEST_TOTAL_WRITTEN_CHARACTER_LIMIT.toLocaleString()} characters or fewer`,
            code: "ATTEMPT_TEXT_TOO_LONG",
            limit: TEST_TOTAL_WRITTEN_CHARACTER_LIMIT,
        }, { status: 413 });
    }

    const saved = await prisma.testAttemptResponse.upsert({
        where: { attemptId_questionId: { attemptId, questionId: body.questionId } },
        update: {
            responseText,
            selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : null,
            isCorrect: null,
            pointsAwarded: null,
            teacherComment: null,
        },
        create: {
            attemptId,
            questionId: body.questionId,
            responseText,
            selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : null,
        },
        select: { questionId: true, responseText: true, selectedOptionId: true, createdAt: true },
    });
    return NextResponse.json({ response: saved, savedAt: new Date().toISOString() });
}
