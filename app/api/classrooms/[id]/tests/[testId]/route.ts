import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { syncTestCalendarEvent } from "@/lib/classroom-test-sync";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { createHash } from "crypto";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

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
        select: { id: true, title: true, description: true, type: true, timeLimit: true, passingScore: true, opensAt: true, closesAt: true },
    });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    return NextResponse.json(test);
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
    if (body.opensAt !== undefined) data.opensAt = body.opensAt ? new Date(body.opensAt) : null;
    if (body.closesAt !== undefined) data.closesAt = body.closesAt ? new Date(body.closesAt) : null;
    const nextOpensAt = body.opensAt !== undefined ? (body.opensAt ? new Date(body.opensAt) : null) : existing.opensAt;
    const nextClosesAt = body.closesAt !== undefined ? (body.closesAt ? new Date(body.closesAt) : null) : existing.closesAt;
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
