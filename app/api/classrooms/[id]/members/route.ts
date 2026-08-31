import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };
const CLASSROOM_ROLES = ["TEACHER", "TEACHING_ASSISTANT", "STUDENT"] as const;
type ClassroomRoleValue = (typeof CLASSROOM_ROLES)[number];

// GET /api/classrooms/[id]/members — List members
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

        const [classroom, members] = await Promise.all([
            prisma.classroom.findUnique({ where: { id }, select: { createdById: true } }),
            prisma.classroomMember.findMany({
            where: { classroomId: id },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
            orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
            }),
        ]);

        return NextResponse.json(members.map((member: any) => ({
            ...member,
            isOwner: member.userId === classroom?.createdById,
            isCurrentUser: member.userId === userId,
        })));
    } catch (e) {
        console.error("GET members", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/members — Add an existing user
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can add members" }, { status: 403 });
        }

        const body = await req.json();
        const email = String(body.email ?? "").trim().toLowerCase();
        const role = String(body.role ?? "TEACHER") as ClassroomRoleValue;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
        }
        if (!CLASSROOM_ROLES.includes(role)) {
            return NextResponse.json({ error: "Invalid classroom role" }, { status: 400 });
        }

        const [classroom, addedUser] = await Promise.all([
            prisma.classroom.findUnique({
                where: { id },
                select: {
                    name: true,
                    courseLinks: {
                        where: { course: { visibility: "INVITATION_ONLY" } },
                        select: { courseId: true, addedById: true },
                    },
                },
            }),
            prisma.user.findUnique({
                where: { email },
                select: { id: true, name: true, email: true, avatar: true },
            }),
        ]);
        if (!classroom) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
        if (!addedUser) {
            return NextResponse.json({ error: "No registered user has this email address" }, { status: 404 });
        }

        const existingMember = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId: addedUser.id, classroomId: id } },
        });
        if (existingMember) {
            return NextResponse.json({ error: "This user is already in the classroom" }, { status: 409 });
        }

        const member = await prisma.classroomMember.create({
            data: { userId: addedUser.id, classroomId: id, role },
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        });

        if (classroom.courseLinks.length) {
            await prisma.courseAccess.createMany({
                data: classroom.courseLinks.map((link: { courseId: string; addedById: string }) => ({
                    courseId: link.courseId,
                    userId: addedUser.id,
                    invitedById: link.addedById,
                })),
                skipDuplicates: true,
            });
        }

        await prisma.notification.create({
            data: {
                userId: addedUser.id,
                title: "Added to classroom",
                body: `You were added to "${classroom.name}"`,
                type: "INVITATION",
                category: "CLASSROOM",
                classroomId: id,
                classroomName: classroom.name,
                actorId: userId,
                actionUrl: `/classroom/${id}`,
                relatedId: id,
                relatedType: "classroom",
            },
        });

        return NextResponse.json({ status: "added", member }, { status: 201 });
    } catch (e) {
        console.error("POST member", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// PATCH /api/classrooms/[id]/members — Change member role
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can change roles" }, { status: 403 });
        }

        const { memberId, role } = await req.json();
        if (!memberId || !CLASSROOM_ROLES.includes(role as ClassroomRoleValue)) {
            return NextResponse.json({ error: "Member ID and role required" }, { status: 400 });
        }

        const target = await prisma.classroomMember.findFirst({
            where: { id: memberId, classroomId: id },
            include: { classroom: { select: { createdById: true } } },
        });
        if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
        if (target.userId === target.classroom.createdById) {
            return NextResponse.json({ error: "The classroom owner must remain a teacher" }, { status: 400 });
        }
        if (target.userId === userId) {
            return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
        }

        const updated = await prisma.classroomMember.update({
            where: { id: memberId },
            data: { role: role as ClassroomRoleValue },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (e) {
        console.error("PATCH member", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id]/members — Remove member
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can remove members" }, { status: 403 });
        }

        const { memberId } = await req.json();
        if (!memberId) {
            return NextResponse.json({ error: "Member ID required" }, { status: 400 });
        }

        // Prevent removing the classroom creator
        const memberToRemove = await prisma.classroomMember.findFirst({
            where: { id: memberId, classroomId: id },
            include: { classroom: { select: { createdById: true } } },
        });
        if (!memberToRemove) return NextResponse.json({ error: "Member not found" }, { status: 404 });
        if (memberToRemove?.userId === memberToRemove?.classroom.createdById) {
            return NextResponse.json({ error: "Cannot remove the classroom creator" }, { status: 400 });
        }
        if (memberToRemove.userId === userId) {
            return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
        }

        await prisma.classroomMember.delete({ where: { id: memberId } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE member", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
