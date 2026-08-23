import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { syncTestCalendarEvent } from "@/lib/classroom-test-sync";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";
import { ScheduleValidationError, assertDeadlineNotPast, parseScheduleDate } from "@/lib/schedule-validation";

type RouteContext = { params: Promise<{ id: string; testId: string }> };
type LearnerAttemptSummary = { id: string; attemptNumber: number; startedAt: Date; submittedAt: Date | null; isCompleted: boolean; score: number | null };

async function teacherAccess(userId: string, classroomId: string) {
    const membership = await prisma.classroomMember.findUnique({
        where: { userId_classroomId: { userId, classroomId } },
        select: { role: true },
    });
    return membership && membership.role !== "STUDENT";
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, testId } = await ctx.params;
    const membership = await prisma.classroomMember.findUnique({ where: { userId_classroomId: { userId, classroomId: id } } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const test = await prisma.test.findFirst({
        where: { id: testId, classroomId: id },
        select: { id: true, title: true, description: true, type: true, timeLimit: true, passingScore: true, opensAt: true, closesAt: true, maxAttempts: true },
    });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    if (membership.role !== "STUDENT") return NextResponse.json(test);

    const attempts = await prisma.testAttempt.findMany({
        where: { testId, userId },
        orderBy: { attemptNumber: "asc" },
        select: { id: true, attemptNumber: true, startedAt: true, submittedAt: true, isCompleted: true, score: true },
    }) as LearnerAttemptSummary[];
    const activeAttempt = attempts.find((attempt) => !attempt.isCompleted) ?? null;
    const completedAttempts = attempts.filter((attempt) => attempt.isCompleted).length;
    const remainingAttempts = Math.max(0, test.maxAttempts - completedAttempts);
    const highestAttemptNumber = attempts.reduce((highest, attempt) => Math.max(highest, attempt.attemptNumber), 0);
    const bestAttempt = attempts
        .filter((attempt) => attempt.isCompleted && attempt.score != null)
        .sort((left, right) => (right.score ?? -1) - (left.score ?? -1))[0] ?? null;
    const now = new Date();
    const available = (!test.opensAt || now >= test.opensAt) && (!test.closesAt || now <= test.closesAt);
    return NextResponse.json({
        ...test,
        questions: [],
        attemptPolicy: {
            maxAttempts: test.maxAttempts,
            completedAttempts,
            remainingAttempts,
            activeAttemptId: activeAttempt?.id ?? null,
            nextAttemptNumber: activeAttempt?.attemptNumber ?? (remainingAttempts > 0 ? highestAttemptNumber + 1 : null),
            canStart: available && Boolean(activeAttempt || remainingAttempts > 0),
        },
        attemptHistory: attempts,
        bestAttempt,
    });
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, testId } = await ctx.params;
    if (!await teacherAccess(userId, id)) return NextResponse.json({ error: "Only teachers/TAs can update tests" }, { status: 403 });

    const existing = await prisma.test.findFirst({ where: { id: testId, classroomId: id } });
    if (!existing) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.type === "TEST" || body.type === "EXAM") data.type = body.type;
    if (body.timeLimit !== undefined) data.timeLimit = body.timeLimit ? Number(body.timeLimit) : null;
    if (body.passingScore !== undefined) data.passingScore = body.passingScore ? Number(body.passingScore) : null;
    let nextOpensAt = existing.opensAt;
    let nextClosesAt = existing.closesAt;
    try {
        if (body.opensAt !== undefined) {
            nextOpensAt = parseScheduleDate(body.opensAt, "Opening time");
            data.opensAt = nextOpensAt;
            if (nextOpensAt && Math.floor(nextOpensAt.getTime() / 60_000) !== Math.floor((existing.opensAt?.getTime() ?? -1) / 60_000)) {
                assertDeadlineNotPast(nextOpensAt, "Opening time");
            }
        }
        if (body.closesAt !== undefined) {
            nextClosesAt = parseScheduleDate(body.closesAt, "Closing time");
            data.closesAt = nextClosesAt;
            if (nextClosesAt && Math.floor(nextClosesAt.getTime() / 60_000) !== Math.floor((existing.closesAt?.getTime() ?? -1) / 60_000)) {
                assertDeadlineNotPast(nextClosesAt, "Closing time");
            }
        }
    } catch (error) {
        if (error instanceof ScheduleValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
    }
    if (body.maxAttempts !== undefined) {
        const maxAttempts = Number(body.maxAttempts);
        if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
            return NextResponse.json({ error: "Attempts allowed must be a positive integer" }, { status: 400 });
        }
        const highestAttempt = await prisma.testAttempt.aggregate({ where: { testId }, _max: { attemptNumber: true } });
        if (maxAttempts < (highestAttempt._max.attemptNumber ?? 0)) {
            return NextResponse.json({ error: "Attempts allowed cannot be lower than an existing attempt number" }, { status: 400 });
        }
        data.maxAttempts = maxAttempts;
    }
    if (nextClosesAt && !nextOpensAt) return NextResponse.json({ error: "Opening date required" }, { status: 400 });
    if (nextOpensAt && nextClosesAt && nextClosesAt < nextOpensAt) {
        return NextResponse.json({ error: "Closing time must be after opening time" }, { status: 400 });
    }

    const updated = await prisma.test.update({ where: { id: testId }, data });
    await syncTestCalendarEvent(testId);
    await notifyClassroomMembers({
        classroomId: id,
        actorId: userId,
        title: `${updated.type === "EXAM" ? "Exam" : "Test"} updated`,
        body: `${updated.title} was changed or rescheduled.`,
        type: "EVENT",
        relatedId: testId,
        relatedType: "test",
        actionUrl: `/classroom/${id}/tests/${testId}`,
    });
    await recordMeaningfulActivity({
        userId, activityType: "TEST_SCHEDULED", classroomId: id, relatedId: testId,
        dedupeKey: `test:schedule:${testId}:${createHash("sha1").update(JSON.stringify(body)).digest("hex")}`,
    });
    return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, testId } = await ctx.params;
    if (!await teacherAccess(userId, id)) return NextResponse.json({ error: "Only teachers/TAs can delete tests" }, { status: 403 });
    const test = await prisma.test.findFirst({ where: { id: testId, classroomId: id } });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    await notifyClassroomMembers({
        classroomId: id,
        actorId: userId,
        title: `${test.type === "EXAM" ? "Exam" : "Test"} removed`,
        body: `${test.title} was removed from the Classroom.`,
        type: "EVENT",
        relatedType: "classroom",
        actionUrl: `/classroom/${id}`,
    });
    await prisma.test.delete({ where: { id: testId } });
    return NextResponse.json({ success: true });
}
