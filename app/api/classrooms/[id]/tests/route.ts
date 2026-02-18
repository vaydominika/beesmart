import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/classrooms/[id]/tests — Create test
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role === "STUDENT") {
            return NextResponse.json({ error: "Only teachers/TAs can create tests" }, { status: 403 });
        }

        const {
            title, description, type = "TEST", timeLimit,
            passingScore, opensAt, closesAt, questions,
        } = await req.json();

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title required" }, { status: 400 });
        }

        const test = await prisma.test.create({
            data: {
                title: title.trim(),
                description: description?.trim() || null,
                type,
                timeLimit: timeLimit ? parseInt(timeLimit) : null,
                passingScore: passingScore ? parseFloat(passingScore) : null,
                opensAt: opensAt ? new Date(opensAt) : null,
                closesAt: closesAt ? new Date(closesAt) : null,
                classroomId: id,
                createdById: userId,
                questions: questions?.length
                    ? {
                        create: questions.map((q: any, i: number) => ({
                            questionText: q.questionText,
                            questionType: q.questionType || "MULTIPLE_CHOICE",
                            order: i,
                            points: q.points || 1,
                            options: q.options?.length
                                ? {
                                    create: q.options.map((o: any, j: number) => ({
                                        optionText: o.optionText,
                                        isCorrect: o.isCorrect || false,
                                        order: j,
                                    })),
                                }
                                : undefined,
                            answers: q.correctAnswer
                                ? {
                                    create: {
                                        answerText: q.correctAnswer,
                                        isCorrect: true,
                                    },
                                }
                                : undefined,
                        })),
                    }
                    : undefined,
            },
            include: {
                _count: { select: { questions: true } },
            },
        });

        // Create post
        await prisma.classroomPost.create({
            data: {
                classroomId: id,
                authorId: userId,
                type: "TEST",
                title: `${type === "EXAM" ? "Exam" : "Test"}: ${title.trim()}`,
                content: description?.trim() || null,
                testId: test.id,
            },
        });

        // Create event if opensAt is set
        if (opensAt) {
            await prisma.event.create({
                data: {
                    title: `${type === "EXAM" ? "Exam" : "Test"}: ${title.trim()}`,
                    description: description?.trim() || null,
                    startDate: new Date(opensAt),
                    endDate: closesAt ? new Date(closesAt) : new Date(opensAt),
                    isAllDay: false,
                    classroomId: id,
                    color: (await prisma.classroom.findUnique({ where: { id }, select: { color: true } }))?.color || null,
                },
            });
        }

        // Notify members
        const members = await prisma.classroomMember.findMany({
            where: { classroomId: id },
            select: { userId: true },
        });
        const classroom = await prisma.classroom.findUnique({
            where: { id }, select: { name: true },
        });

        await prisma.notification.createMany({
            data: members
                .filter((m: any) => m.userId !== userId)
                .map((m: any) => ({
                    userId: m.userId,
                    title: `New ${type === "EXAM" ? "Exam" : "Test"} in ${classroom?.name}`,
                    body: title.trim(),
                    type: "ASSIGNMENT" as const,
                    relatedId: test.id,
                    relatedType: "test",
                })),
        });

        return NextResponse.json(test, { status: 201 });
    } catch (e) {
        console.error("POST test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
