import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/classrooms/[id]/invite — Invite by email
export async function POST(req: NextRequest, ctx: RouteContext) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { id } = await ctx.params;

        const membership = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: id } },
        });
        if (!membership || membership.role !== "TEACHER") {
            return NextResponse.json({ error: "Only teachers can invite" }, { status: 403 });
        }

        const { email, role = "STUDENT" } = await req.json();
        if (!email?.trim()) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await prisma.classroomInvitation.create({
            data: {
                classroomId: id,
                email: email.trim().toLowerCase(),
                role,
                token,
                invitedById: userId,
                expiresAt,
            },
        });

        // Create notification if user exists
        const invitedUser = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
        });
        if (invitedUser) {
            const classroom = await prisma.classroom.findUnique({ where: { id } });
            await prisma.notification.create({
                data: {
                    userId: invitedUser.id,
                    title: "Classroom Invitation",
                    body: `You've been invited to join "${classroom?.name}"`,
                    type: "INVITATION",
                    relatedId: id,
                    relatedType: "classroom",
                },
            });
        }

        return NextResponse.json({ success: true, token: invitation.token }, { status: 201 });
    } catch (e) {
        console.error("POST /api/classrooms/[id]/invite", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
