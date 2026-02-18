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

        // Get all graded assignments in the classroom
        const assignments = await prisma.assignedWork.findMany({
            where: { classroomId: id, isGraded: true },
            select: { id: true, title: true, maxPoints: true, dueDate: true },
            orderBy: { createdAt: "asc" },
        });

        // Get all tests in the classroom
        const tests = await prisma.test.findMany({
            where: { classroomId: id },
            select: { id: true, title: true, type: true },
            orderBy: { createdAt: "asc" },
        });

        if (membership.role === "STUDENT") {
            // Student sees own grades
            const assignmentGrades = await prisma.grade.findMany({
                where: {
                    userId,
                    assignedWorkId: { in: assignments.map((a: any) => a.id) },
                },
                include: {
                    assignedWork: { select: { title: true, maxPoints: true } },
                },
            });

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
                    return {
                        ...a,
                        grade: grade ? { score: grade.score, maxScore: grade.maxScore, feedback: grade.feedback } : null,
                    };
                }),
                tests: tests.map((t: any) => {
                    const attempt = testAttempts.find((a: any) => a.testId === t.id);
                    return {
                        ...t,
                        attempt: attempt ? { score: attempt.score, submittedAt: attempt.submittedAt } : null,
                    };
                }),
            });
        } else {
            // Teacher sees all students' grades
            const students = await prisma.classroomMember.findMany({
                where: { classroomId: id, role: "STUDENT" },
                include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            });

            const allGrades = await prisma.grade.findMany({
                where: {
                    assignedWorkId: { in: assignments.map((a: any) => a.id) },
                },
            });

            const allAttempts = await prisma.testAttempt.findMany({
                where: {
                    testId: { in: tests.map((t: any) => t.id) },
                    isCompleted: true,
                },
            });

            const studentGrades = students.map((s: any) => ({
                student: s.user,
                assignmentGrades: assignments.map((a: any) => {
                    const grade = allGrades.find((g: any) => g.assignedWorkId === a.id && g.userId === s.userId);
                    return {
                        assignmentId: a.id,
                        score: grade?.score ?? null,
                        maxScore: grade?.maxScore ?? a.maxPoints ?? null,
                    };
                }),
                testGrades: tests.map((t: any) => {
                    const attempt = allAttempts.find((a: any) => a.testId === t.id && a.userId === s.userId);
                    return {
                        testId: t.id,
                        score: attempt?.score ?? null,
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
