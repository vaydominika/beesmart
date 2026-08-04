import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import { canAccessCourse } from "@/lib/course-access";
import { notifyClassroomMembers } from "@/lib/notifications";
import { recordMeaningfulActivity } from "@/lib/activity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const membership = await prisma.classroomMember.findUnique({ where: { userId_classroomId: { userId, classroomId: id } } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const links = await prisma.classroomCourse.findMany({
        where: { classroomId: id },
        include: { course: { include: { creator: { select: { name: true } }, _count: { select: { modules: true } } } } },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(links.map((link: any) => link.course));
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await ctx.params;
    const membership = await prisma.classroomMember.findUnique({ where: { userId_classroomId: { userId, classroomId: id } } });
    if (!membership || membership.role === "STUDENT") return NextResponse.json({ error: "Only teachers/TAs can add courses" }, { status: 403 });
    const { courseId } = await req.json();
    if (!courseId || !await canAccessCourse(courseId, userId)) return NextResponse.json({ error: "Course is not available" }, { status: 403 });
    const duplicate = await prisma.classroomCourse.findUnique({ where: { classroomId_courseId: { classroomId: id, courseId } } });
    if (duplicate) return NextResponse.json({ error: "This course is already in the Classroom" }, { status: 409 });
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, visibility: true } });
    if (!course || course.visibility === "PRIVATE") {
        return NextResponse.json({ error: "Private courses cannot be assigned. Change the course visibility first." }, { status: 403 });
    }
    const link = await prisma.classroomCourse.create({ data: { classroomId: id, courseId, addedById: userId } });
    if (course.visibility === "INVITATION_ONLY") {
        const members = await prisma.classroomMember.findMany({ where: { classroomId: id }, select: { userId: true } });
        await prisma.courseAccess.createMany({
            data: members.map((member: { userId: string }) => ({ courseId, userId: member.userId, invitedById: userId })),
            skipDuplicates: true,
        });
    }
    await prisma.classroomPost.create({
        data: { classroomId: id, authorId: userId, type: "COURSE", title: course?.title ?? "Course", courseId },
    });
    await notifyClassroomMembers({
        classroomId: id, actorId: userId, title: "Course added", body: `${course?.title ?? "A course"} was added to the Classroom.`,
        type: "OTHER", relatedId: courseId, relatedType: "course", actionUrl: `/courses/${courseId}`,
    });
    await recordMeaningfulActivity({
        userId, activityType: "CLASSROOM_COURSE_PUBLISHED", classroomId: id, courseId, relatedId: courseId,
        dedupeKey: `classroom:course:${id}:${courseId}`,
    });
    return NextResponse.json(link, { status: 201 });
}
