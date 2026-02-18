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
            include: { _count: { select: { members: true } } },
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

        await prisma.classroomMember.create({
            data: {
                userId,
                classroomId: classroom.id,
                role: "STUDENT",
            },
        });

        return NextResponse.json({
            id: classroom.id,
            name: classroom.name,
            description: classroom.description,
            code: classroom.code,
            color: classroom.color,
            subject: classroom.subject,
            role: "STUDENT",
            memberCount: classroom._count.members + 1,
        });
    } catch (e) {
        console.error("POST /api/classrooms/join", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
