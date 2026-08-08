import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { syncTestCalendarEvent } from "@/lib/classroom-test-sync";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";

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
            passingScore, opensAt, closesAt, maxAttempts = 1, questions,
        } = await req.json();

        if (!title?.trim()) {
            return NextResponse.json({ error: "Title required" }, { status: 400 });
        }
        if (closesAt && !opensAt) return NextResponse.json({ error: "Opening date required" }, { status: 400 });
        if (opensAt && closesAt && new Date(closesAt) < new Date(opensAt)) {
            return NextResponse.json({ error: "Closing time must be after opening time" }, { status: 400 });
        }
        const parsedMaxAttempts = Number(maxAttempts);
        if (!Number.isSafeInteger(parsedMaxAttempts) || parsedMaxAttempts < 1) {
            return NextResponse.json({ error: "Attempts allowed must be a positive integer" }, { status: 400 });
        }
        if (Array.isArray(questions)) {
            const invalidShortAnswer = questions.find((question: any) => question.questionType === "SHORT_ANSWER"
                && !(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [question.correctAnswer])
                    .some((answer: unknown) => typeof answer === "string" && Boolean(answer.trim())));
            if (invalidShortAnswer) return NextResponse.json({ error: "Every short-answer question needs an accepted answer" }, { status: 400 });
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
                maxAttempts: parsedMaxAttempts,
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
                            answers: ((Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0) || q.correctAnswer)
                                ? {
                                    create: (Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [q.correctAnswer])
                                        .filter((answer: unknown): answer is string => typeof answer === "string" && Boolean(answer.trim()))
                                        .map((answer: string) => ({
                                            answerText: answer.trim(),
                                            isCorrect: true,
                                        })),
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

        await syncTestCalendarEvent(test.id);
        await notifyClassroomMembers({
            classroomId: id,
            actorId: userId,
            title: `New ${type === "EXAM" ? "exam" : "test"}`,
            body: opensAt ? `${title.trim()} was scheduled.` : `${title.trim()} was created.`,
            type: "ASSIGNMENT",
            relatedId: test.id,
            relatedType: "test",
            actionUrl: `/classroom/${id}/tests/${test.id}`,
        });
        await recordMeaningfulActivity({
            userId,
            activityType: opensAt ? "TEST_SCHEDULED" : "TEST_CREATED",
            classroomId: id,
            relatedId: test.id,
            dedupeKey: `test:create:${test.id}`,
        });

        return NextResponse.json(test, { status: 201 });
    } catch (e) {
        console.error("POST test", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
