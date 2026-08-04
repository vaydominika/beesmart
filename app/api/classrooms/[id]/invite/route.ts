import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };
const CLASSROOM_ROLES = ["TEACHER", "TEACHING_ASSISTANT", "STUDENT"] as const;
type ClassroomRoleValue = (typeof CLASSROOM_ROLES)[number];

async function requireTeacher(classroomId: string) {
    const userId = await getCurrentUserId();
    if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

    const membership = await prisma.classroomMember.findUnique({
        where: { userId_classroomId: { userId, classroomId } },
    });
    if (!membership || membership.role !== "TEACHER") {
        return { error: NextResponse.json({ error: "Only teachers can manage invitations" }, { status: 403 }) };
    }

    return { userId };
}

// GET /api/classrooms/[id]/invite — List pending invitations
export async function GET(_req: NextRequest, ctx: RouteContext) {
    try {
        const { id } = await ctx.params;
        const auth = await requireTeacher(id);
        if (auth.error) return auth.error;

        const invitations = await prisma.classroomInvitation.findMany({
            where: { classroomId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(invitations);
    } catch (error) {
        console.error("GET classroom invitations", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms/[id]/invite — Add an existing user or create an email invitation
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const { id } = await ctx.params;
        const auth = await requireTeacher(id);
        if (auth.error) return auth.error;
        if (!auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const email = String(body.email ?? "").trim().toLowerCase();
        const role = String(body.role ?? "TEACHER") as ClassroomRoleValue;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
        }
        if (!CLASSROOM_ROLES.includes(role)) {
            return NextResponse.json({ error: "Invalid classroom role" }, { status: 400 });
        }

        const classroom = await prisma.classroom.findUnique({
            where: { id },
            select: {
                name: true,
                code: true,
                courseLinks: {
                    where: { course: { visibility: "INVITATION_ONLY" } },
                    select: { courseId: true, addedById: true },
                },
            },
        });
        if (!classroom) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

        const invitedUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, avatar: true },
        });

        if (invitedUser) {
            const existingMember = await prisma.classroomMember.findUnique({
                where: { userId_classroomId: { userId: invitedUser.id, classroomId: id } },
            });
            if (existingMember) {
                return NextResponse.json({ error: "This user is already in the classroom" }, { status: 409 });
            }

            const member = await prisma.classroomMember.create({
                data: { userId: invitedUser.id, classroomId: id, role },
                include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            });

            if (classroom.courseLinks.length) {
                await prisma.courseAccess.createMany({
                    data: classroom.courseLinks.map((link: { courseId: string; addedById: string }) => ({
                        courseId: link.courseId,
                        userId: invitedUser.id,
                        invitedById: link.addedById,
                    })),
                    skipDuplicates: true,
                });
            }

            await Promise.all([
                prisma.classroomInvitation.updateMany({
                    where: { classroomId: id, email, acceptedAt: null },
                    data: { acceptedAt: new Date() },
                }),
                prisma.notification.create({
                    data: {
                        userId: invitedUser.id,
                        title: "Added to classroom",
                        body: `You were added to "${classroom.name}"`,
                        type: "INVITATION",
                        category: "CLASSROOM",
                        classroomId: id,
                        classroomName: classroom.name,
                        actorId: auth.userId,
                        actionUrl: `/classroom/${id}`,
                        relatedId: id,
                        relatedType: "classroom",
                    },
                }),
            ]);

            return NextResponse.json({ status: "added", member }, { status: 201 });
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const existingInvitation = await prisma.classroomInvitation.findFirst({
            where: { classroomId: id, email, acceptedAt: null },
        });
        if (existingInvitation) {
            await prisma.classroomInvitation.update({
                where: { id: existingInvitation.id },
                data: { role, expiresAt, invitedById: auth.userId },
            });
        } else {
            await prisma.classroomInvitation.create({
                data: {
                    classroomId: id,
                    email,
                    role,
                    token: crypto.randomBytes(32).toString("hex"),
                    invitedById: auth.userId,
                    expiresAt,
                },
            });
        }

        return NextResponse.json({ status: "invited", classroomCode: classroom.code }, { status: 201 });
    } catch (error) {
        console.error("POST classroom invitation", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// DELETE /api/classrooms/[id]/invite — Cancel a pending invitation
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const { id } = await ctx.params;
        const auth = await requireTeacher(id);
        if (auth.error) return auth.error;

        const { invitationId } = await req.json();
        if (!invitationId) return NextResponse.json({ error: "Invitation ID required" }, { status: 400 });

        const invitation = await prisma.classroomInvitation.findFirst({
            where: { id: invitationId, classroomId: id, acceptedAt: null },
            select: { id: true },
        });
        if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

        await prisma.classroomInvitation.delete({ where: { id: invitation.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE classroom invitation", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
