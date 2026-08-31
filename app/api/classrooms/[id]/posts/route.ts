import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";
import { canAccessCourse } from "@/lib/course-access";
import { syncTestCalendarEvent } from "@/lib/classroom-test-sync";
import { DeadlineValidationError, parseAssignmentDeadline } from "@/lib/assignment-deadline";
import type { AssignmentDraft, TestDraft } from "@/lib/classroom-post-drafts";
import type { PostType, Prisma } from "@/lib/generated/prisma";
import { richTextToPlainText, sanitizeRichTextHtml } from "@/lib/security/rich-text";
import { claimUploads, UploadClaimError } from "@/lib/files/lifecycle";
import { storedFileUrl } from "@/lib/files/types";
import { ScheduleValidationError, assertDeadlineNotPast, parseNewTestSchedule } from "@/lib/schedule-validation";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/classrooms/[id]/posts — List posts with search/filter/sort
export async function GET(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const url = new URL(req.url);
        const search = url.searchParams.get("search") || "";
        const type = url.searchParams.get("type") || "";
        const sort = url.searchParams.get("sort") || "newest";
        const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
        const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
        const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;

        const where: Record<string, unknown> = { classroomId: id };
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { content: { contains: search } },
                { author: { name: { contains: search } } },
            ];
        }

        const [posts, total] = await Promise.all([
            prisma.classroomPost.findMany({
                where,
                include: {
                    author: { select: { id: true, name: true, avatar: true } },
                    _count: { select: { comments: true, files: true } },
                    files: true,
                    assignment: {
                        select: {
                            id: true, title: true, deadlineAt: true, deadlineTimeZone: true, deadlineHasTime: true,
                            isGraded: true, maxPoints: true,
                            _count: { select: { submissions: true } },
                        },
                    },
                    test: {
                        select: {
                            id: true, title: true, type: true, timeLimit: true,
                            opensAt: true, closesAt: true, passingScore: true,
                        },
                    },
                    course: {
                        select: {
                            id: true, title: true, description: true, visibility: true, coverImageUrl: true, coverStoredFileId: true,
                            creator: { select: { name: true } },
                            _count: { select: { modules: true } },
                        },
                    },
                },
                orderBy: [
                    { isPinned: "desc" },
                    { createdAt: sort === "oldest" ? "asc" : "desc" },
                    { id: sort === "oldest" ? "asc" : "desc" },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.classroomPost.count({ where }),
        ]);

        return NextResponse.json({
            posts: posts.map((post: any) => ({
                ...post,
                files: post.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })),
                course: post.course ? { ...post.course, coverImageUrl: storedFileUrl(post.course.coverStoredFileId, post.course.coverImageUrl) || null } : null,
                isOwnPost: post.author.id === userId,
            })),
            total,
            page,
            limit,
            hasMore: page * limit < total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (e) {
        console.error("GET /api/classrooms/[id]/posts", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/posts — Create a post
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const data = await req.json();
        const { type, title, content, isPinned } = data;
        const assignment = data.assignment as AssignmentDraft | null | undefined;
        const test = data.test as TestDraft | null | undefined;
        const testSourceCourseId = test?.sourceCourseId && typeof test.sourceCourseId === "string" ? test.sourceCourseId : null;
        const courseId = typeof data.courseId === "string" && data.courseId ? data.courseId : null;
        const structuredAttachmentCount = Number(Boolean(assignment)) + Number(Boolean(test)) + Number(Boolean(courseId));
        if (structuredAttachmentCount > 1) {
            return NextResponse.json({ error: "Add one assignment, test, or course per post" }, { status: 400 });
        }

        const allowedTypes: PostType[] = ["TEXT", "PHOTO", "ASSIGNMENT", "TEST", "COURSE", "MATERIAL"];
        const normalizedType: PostType = test
            ? "TEST"
            : assignment
                ? "ASSIGNMENT"
                : courseId
                    ? "COURSE"
                    : (allowedTypes.includes(type as PostType) ? type as PostType : "TEXT");

        // Only teachers/TAs can create certain post types
        const teacherOnlyTypes: PostType[] = ["ASSIGNMENT", "TEST", "COURSE"];
        if (teacherOnlyTypes.includes(normalizedType) && membership.role === "STUDENT") {
            return NextResponse.json({ error: "Students cannot create this type of post" }, { status: 403 });
        }

        if (assignment) {
            if (!assignment.title?.trim() || !assignment.dueDate) {
                return NextResponse.json({ error: "Assignment title and due date are required" }, { status: 400 });
            }
        }
        const assignmentDeadline = assignment ? parseAssignmentDeadline(assignment) : null;
        if (assignmentDeadline) assertDeadlineNotPast(assignmentDeadline.deadlineAt, "Assignment deadline");

        const testSchedule = test ? parseNewTestSchedule(test.opensAt, test.closesAt) : null;
        if (test) {
            if (!test.title?.trim() || !Array.isArray(test.questions) || test.questions.length === 0) {
                return NextResponse.json({ error: "Test title and questions are required" }, { status: 400 });
            }
            if (testSourceCourseId && !await canAccessCourse(testSourceCourseId, userId)) {
                return NextResponse.json({ error: "The selected source course is not available" }, { status: 403 });
            }
            if (!Number.isSafeInteger(Number(test.maxAttempts ?? 1)) || Number(test.maxAttempts ?? 1) < 1) {
                return NextResponse.json({ error: "Attempts allowed must be a positive integer" }, { status: 400 });
            }
            if (test.questions.some((question) => question.questionType === "SHORT_ANSWER" && !(question.acceptedAnswers?.length || question.correctAnswer?.trim()))) {
                return NextResponse.json({ error: "Every short-answer question needs an accepted answer" }, { status: 400 });
            }
        }

        const course = courseId
            ? await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, visibility: true } })
            : null;
        if (courseId && (!course || !await canAccessCourse(courseId, userId))) {
            return NextResponse.json({ error: "Course is not available" }, { status: 403 });
        }
        if (course?.visibility === "PRIVATE") {
            return NextResponse.json({ error: "Private courses cannot be shared. Change the course visibility first." }, { status: 403 });
        }

        const postUploadIds = Array.isArray(data.uploadIds) ? data.uploadIds : [];
        const assignmentUploadIds = assignment?.files?.map((file) => file.uploadId) ?? [];
        const allUploadIds = [...postUploadIds, ...assignmentUploadIds];
        const sanitizedContent = sanitizeRichTextHtml(content);
        const plainText = richTextToPlainText(sanitizedContent);
        const hasFiles = allUploadIds.length > 0;
        if (!title?.trim() && !plainText && !hasFiles && !courseId && !assignment && !test) {
            return NextResponse.json({ error: "Write a message or add something to the post" }, { status: 400 });
        }

        const post = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const claimedFiles = await claimUploads(tx, allUploadIds, userId, "POST_ATTACHMENT");
            let assignmentId = typeof data.assignmentId === "string" ? data.assignmentId : null;
            let testId = typeof data.testId === "string" ? data.testId : null;

            if (assignment) {
                const createdAssignment = await tx.assignedWork.create({
                    data: {
                        title: assignment.title.trim(),
                        description: assignment.description?.trim() || null,
                        assignedById: userId,
                        classroomId: id,
                        ...assignmentDeadline!,
                        isGraded: assignment.isGraded,
                        maxPoints: assignment.maxPoints ? parseFloat(assignment.maxPoints) : null,
                    },
                });
                assignmentId = createdAssignment.id;

                await tx.event.create({
                    data: {
                        title: `Assignment: ${assignment.title.trim()}`,
                        description: assignment.description?.trim() || null,
                        startDate: assignmentDeadline!.deadlineAt,
                        endDate: assignmentDeadline!.deadlineAt,
                        startTime: assignment.dueTime || null,
                        endTime: assignment.dueTime || null,
                        isAllDay: !assignment.dueTime,
                        isProtected: true,
                        classroomId: id,
                        assignmentId: createdAssignment.id,
                    },
                });
            }

            if (test) {
                const createdTest = await tx.test.create({
                    data: {
                        title: test.title.trim(),
                        description: test.description?.trim() || null,
                        type: test.type === "EXAM" ? "EXAM" : "TEST",
                        timeLimit: test.timeLimit ? parseInt(test.timeLimit) : null,
                        passingScore: test.passingScore ? parseFloat(test.passingScore) : null,
                        opensAt: testSchedule!.opensAt,
                        closesAt: testSchedule!.closesAt,
                        maxAttempts: Number(test.maxAttempts ?? 1),
                        classroomId: id,
                        createdById: userId,
                        questions: {
                            create: test.questions.map((question, questionIndex) => ({
                                questionText: question.questionText.trim(),
                                questionType: question.questionType,
                                order: questionIndex,
                                points: question.points || 1,
                                options: question.options?.length
                                    ? {
                                        create: question.options.map((option, optionIndex) => ({
                                            optionText: option.optionText.trim(),
                                            isCorrect: Boolean(option.isCorrect),
                                            order: optionIndex,
                                        })),
                                    }
                                    : undefined,
                                answers: (question.acceptedAnswers?.length || question.correctAnswer)
                                    ? {
                                        create: (question.acceptedAnswers?.length ? question.acceptedAnswers : [question.correctAnswer!]).map((answer) => ({
                                            answerText: answer.trim(),
                                            isCorrect: true,
                                        })),
                                    }
                                    : undefined,
                            })),
                        },
                    },
                });
                testId = createdTest.id;
            }

            const createdPost = await tx.classroomPost.create({
                data: {
                    classroomId: id,
                    authorId: userId,
                    type: normalizedType,
                    title: title?.trim() || null,
                    content: plainText ? sanitizedContent : null,
                    isPinned: Boolean(isPinned),
                    courseId,
                    assignmentId,
                    testId,
                    files: hasFiles
                        ? {
                            create: claimedFiles.map((file) => ({
                                fileName: file.originalName,
                                fileType: file.fileType,
                                fileSize: file.size,
                                storedFileId: file.id,
                            })),
                        }
                        : undefined,
                },
                include: {
                    author: { select: { id: true, name: true, avatar: true } },
                    _count: { select: { comments: true, files: true } },
                    files: true,
                    assignment: true,
                    test: true,
                },
            });

            return createdPost;
        });

        if (post.testId) await syncTestCalendarEvent(post.testId);

        if (courseId && course?.visibility === "INVITATION_ONLY") {
            const members = await prisma.classroomMember.findMany({ where: { classroomId: id }, select: { userId: true } });
            await prisma.courseAccess.createMany({
                data: members.map((member: { userId: string }) => ({ courseId, userId: member.userId, invitedById: userId })),
                skipDuplicates: true,
            });
        }

        const notification = post.assignment
            ? {
                title: "New assignment",
                body: post.assignment.title,
                type: "ASSIGNMENT" as const,
                relatedId: post.assignment.id,
                relatedType: "assignment",
                actionUrl: `/classroom/${id}/assignments/${post.assignment.id}`,
            }
            : post.test
                ? {
                    title: `New ${post.test.type === "EXAM" ? "exam" : "test"}`,
                    body: post.test.opensAt ? `${post.test.title} was scheduled.` : `${post.test.title} was created.`,
                    type: "ASSIGNMENT" as const,
                    relatedId: post.test.id,
                    relatedType: "test",
                    actionUrl: `/classroom/${id}/tests/${post.test.id}`,
                }
                : {
                    title: courseId ? "New Classroom course" : hasFiles ? "New Classroom material" : "New Classroom post",
                    body: plainText ? plainText.slice(0, 180) : (course?.title || title?.trim() || "A file was shared."),
                    type: "OTHER" as const,
                    relatedId: post.id,
                    relatedType: "post",
                    actionUrl: `/classroom/${id}`,
                };

        const activityType = post.assignment
            ? "ASSIGNMENT_CREATED"
            : post.test
                ? (post.test.opensAt ? "TEST_SCHEDULED" : "TEST_CREATED")
                : courseId
                    ? "CLASSROOM_COURSE_PUBLISHED"
                    : hasFiles
                        ? "MATERIAL_UPLOADED"
                        : "CLASSROOM_POST_PUBLISHED";
        const activityRelatedId = post.assignment?.id || post.test?.id || post.id;

        const sideEffects = await Promise.allSettled([
            notifyClassroomMembers({
                classroomId: id,
                actorId: userId,
                ...notification,
            }),
            recordMeaningfulActivity({
                userId,
                activityType,
                classroomId: id,
                courseId,
                relatedId: activityRelatedId,
                dedupeKey: `${activityType.toLowerCase()}:${activityRelatedId}`,
            }),
        ]);
        sideEffects.forEach((result) => {
            if (result.status === "rejected") console.error("Classroom post side effect failed", result.reason);
        });

        return NextResponse.json({ ...post, files: post.files.map((file: any) => ({ ...file, fileUrl: storedFileUrl(file.storedFileId, file.fileUrl) })) }, { status: 201 });
    } catch (e) {
        if (e instanceof UploadClaimError) return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof DeadlineValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }
        if (e instanceof ScheduleValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
        console.error("POST /api/classrooms/[id]/posts", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
