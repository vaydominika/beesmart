import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id]/gradebook
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        // Get all assignments that are still published in the classroom.
        const assignments = await prisma.assignedWork.findMany({
            where: {
                classroomId: id,
                posts: { some: { classroomId: id } },
                ...(membership.role === "STUDENT"
                    ? { OR: [{ assignedToId: null }, { assignedToId: userId }] }
                    : {}),
            },
            select: { id: true, title: true, maxPoints: true, deadlineAt: true, deadlineTimeZone: true, deadlineHasTime: true },
            orderBy: { createdAt: "asc" },
        });

        // Get all tests in the classroom
        const tests = await prisma.test.findMany({
            where: {
                classroomId: id,
                posts: { some: { classroomId: id } },
            },
            select: { id: true, title: true, type: true },
            orderBy: { createdAt: "asc" },
        });

        if (membership.role === "STUDENT") {
            // Student sees own grades
            const [assignmentGrades, submissions] = await Promise.all([
                prisma.grade.findMany({
                    where: {
                        userId,
                        assignedWorkId: { in: assignments.map((a: any) => a.id) },
                    },
                    include: {
                        assignedWork: { select: { title: true, maxPoints: true } },
                    },
                }),
                prisma.submission.findMany({
                    where: { userId, assignedWorkId: { in: assignments.map((a: any) => a.id) } },
                    select: { assignedWorkId: true, status: true, submittedAt: true },
                }),
            ]);

            const testAttempts = await prisma.testAttempt.findMany({
                where: {
                    userId,
                    testId: { in: tests.map((t: any) => t.id) },
                    isCompleted: true,
                },
                include: {
                    test: { select: { title: true, type: true } },
                },
            });

            return NextResponse.json({
                role: "STUDENT",
                assignments: assignments.map((a: any) => {
                    const grade = assignmentGrades.find((g: any) => g.assignedWorkId === a.id);
                    const submission = submissions.find((item: any) => item.assignedWorkId === a.id);
                    return {
                        ...a,
                        grade: grade ? { score: grade.score, maxScore: grade.maxScore, feedback: grade.feedback } : null,
                        submission: submission ? { status: submission.status, submittedAt: submission.submittedAt } : null,
                    };
                }),
                tests: tests.map((t: any) => {
                    const attempts = testAttempts.filter((a: any) => a.testId === t.id);
                    const attempt = attempts.sort((a: any, b: any) => {
                        const scoreDifference = (b.score ?? -1) - (a.score ?? -1);
                        return scoreDifference || new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime();
                    })[0];
                    return {
                        ...t,
                        attempt: attempt ? { id: attempt.id, score: attempt.score, submittedAt: attempt.submittedAt } : null,
                    };
                }),
            });
        } else {
            // Teacher sees all students' grades
            const students = await prisma.classroomMember.findMany({
                where: { classroomId: id, role: "STUDENT" },
                include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            });

            const [allGrades, allSubmissions, allAttempts] = await Promise.all([
                prisma.grade.findMany({
                    where: { assignedWorkId: { in: assignments.map((a: any) => a.id) } },
                }),
                prisma.submission.findMany({
                    where: { assignedWorkId: { in: assignments.map((a: any) => a.id) } },
                    select: { assignedWorkId: true, userId: true, status: true, submittedAt: true },
                }),
                prisma.testAttempt.findMany({
                    where: {
                        testId: { in: tests.map((t: any) => t.id) },
                        isCompleted: true,
                    },
                }),
            ]);

            const studentGrades = students.map((s: any) => ({
                student: s.user,
                assignmentGrades: assignments.map((a: any) => {
                    const grade = allGrades.find((g: any) => g.assignedWorkId === a.id && g.userId === s.userId);
                    const submission = allSubmissions.find((item: any) => item.assignedWorkId === a.id && item.userId === s.userId);
                    return {
                        assignmentId: a.id,
                        score: grade?.score ?? null,
                        maxScore: grade?.maxScore ?? a.maxPoints ?? null,
                        submissionStatus: submission?.status ?? null,
                        submittedAt: submission?.submittedAt ?? null,
                    };
                }),
                testGrades: tests.map((t: any) => {
                    const attempt = allAttempts
                        .filter((a: any) => a.testId === t.id && a.userId === s.userId)
                        .sort((a: any, b: any) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime())[0];
                    return {
                        testId: t.id,
                        attemptId: attempt?.id ?? null,
                        score: attempt?.score ?? null,
                        submittedAt: attempt?.submittedAt ?? null,
                    };
                }),
            }));

            return NextResponse.json({
                role: "TEACHER",
                assignments,
                tests,
                students: studentGrades,
            });
        }
    } catch (e) {
        console.error("GET gradebook", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
