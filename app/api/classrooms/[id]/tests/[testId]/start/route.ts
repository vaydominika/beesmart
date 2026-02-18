import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string; testId: string }> };

// POST /api/classrooms/[id]/tests/[testId]/start — Start test attempt
export async function POST(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id, testId } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const test = await prisma.test.findUnique({
            where: { id: testId },
            include: {
                questions: {
                    include: {
                        options: { orderBy: { order: "asc" } },
                    },
                    orderBy: { order: "asc" },
                },
            },
        });

        if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

        // Check if test is open
        const now = new Date();
        if (test.opensAt && now < test.opensAt) {
            return NextResponse.json({ error: "Test is not open yet" }, { status: 400 });
        }
        if (test.closesAt && now > test.closesAt) {
            return NextResponse.json({ error: "Test is closed" }, { status: 400 });
        }

        // Check if already has an incomplete attempt
        const existingAttempt = await prisma.testAttempt.findFirst({
            where: { testId, userId, isCompleted: false },
        });

        if (existingAttempt) {
            // Return existing attempt with questions
            return NextResponse.json({
                attempt: existingAttempt,
                test: {
                    id: test.id,
                    title: test.title,
                    description: test.description,
                    type: test.type,
                    timeLimit: test.timeLimit,
                    questions: test.questions.map((q: any) => ({
                        id: q.id,
                        questionText: q.questionText,
                        questionType: q.questionType,
                        points: q.points,
                        options: q.options.map((o: any) => ({
                            id: o.id,
                            optionText: o.optionText,
                        })),
                    })),
                },
            });
        }

        // Create new attempt
        const attempt = await prisma.testAttempt.create({
            data: {
                testId,
                userId,
            },
        });

        return NextResponse.json({
            attempt,
            test: {
                id: test.id,
                title: test.title,
                description: test.description,
                type: test.type,
                timeLimit: test.timeLimit,
                questions: test.questions.map((q: any) => ({
                    id: q.id,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    points: q.points,
                    options: q.options.map((o: any) => ({
                        id: o.id,
                        optionText: o.optionText,
                    })),
                })),
            },
        }, { status: 201 });
    } catch (e) {
        console.error("POST start test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
