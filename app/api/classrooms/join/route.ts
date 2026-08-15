import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

// POST /api/classrooms/join — Join a classroom by code
export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { code } = await req.json();
        if (!code?.trim()) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const classroom = await prisma.classroom.findUnique({
            where: { code: code.trim().toUpperCase() },
            include: {
                _count: { select: { members: true } },
                courseLinks: { where: { course: { visibility: "INVITATION_ONLY" } }, select: { courseId: true, addedById: true } },
            },
        });

        if (!classroom) {
            return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
        }

        // Check if already a member
        const existing = await prisma.classroomMember.findUnique({
            where: { userId_classroomId: { userId, classroomId: classroom.id } },
        });

        if (existing) {
            return NextResponse.json({ error: "Already a member of this classroom" }, { status: 409 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        const invitation = user?.email ? await prisma.classroomInvitation.findFirst({
            where: {
                classroomId: classroom.id,
                email: user.email.toLowerCase(),
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        }) : null;
        const role = invitation?.role ?? "STUDENT";

        await prisma.classroomMember.create({
            data: {
                userId,
                classroomId: classroom.id,
                role,
            },
        });
        if (invitation) {
            await prisma.classroomInvitation.update({
                where: { id: invitation.id },
                data: { acceptedAt: new Date() },
            });
        }
        if (classroom.courseLinks?.length) {
            await prisma.courseAccess.createMany({
                data: classroom.courseLinks.map((link: { courseId: string; addedById: string }) => ({
                    courseId: link.courseId, userId, invitedById: link.addedById,
                })),
                skipDuplicates: true,
            });
        }

        return NextResponse.json({
            id: classroom.id,
            name: classroom.name,
            description: classroom.description,
            code: classroom.code,
            subject: classroom.subject,
            role,
            memberCount: classroom._count.members + 1,
            createdAt: classroom.createdAt,
            isOwner: false,
        });
    } catch (e) {
        console.error("POST /api/classrooms/join", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
