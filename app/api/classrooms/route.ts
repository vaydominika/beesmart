import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

function generateCode(length = 6): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// GET /api/classrooms — List user's classrooms
export async function GET() {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const memberships = await prisma.classroomMember.findMany({
            where: { userId },
            include: {
                classroom: {
                    include: {
                        _count: { select: { members: true } },
                        creator: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { joinedAt: "desc" },
        });

        const classrooms = memberships.map((m: any) => ({
            id: m.classroom.id,
            name: m.classroom.name,
            description: m.classroom.description,
            code: m.classroom.code,
            color: m.classroom.color,
            subject: m.classroom.subject,
            role: m.role,
            memberCount: m.classroom._count.members,
            creatorName: m.classroom.creator.name,
            createdAt: m.classroom.createdAt,
        }));

        return NextResponse.json(classrooms);
    } catch (e) {
        console.error("GET /api/classrooms", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

// POST /api/classrooms — Create a classroom
export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { name, description, subject, color } = await req.json();
        if (!name?.trim()) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Generate unique code
        let code = generateCode();
        let existing = await prisma.classroom.findUnique({ where: { code } });
        while (existing) {
            code = generateCode();
            existing = await prisma.classroom.findUnique({ where: { code } });
        }

        const classroom = await prisma.classroom.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                subject: subject?.trim() || null,
                color: color || null,
                code,
                createdById: userId,
                members: {
                    create: { userId, role: "TEACHER" },
                },
            },
            include: { _count: { select: { members: true } } },
        });

        return NextResponse.json({
            id: classroom.id,
            name: classroom.name,
            description: classroom.description,
            code: classroom.code,
            color: classroom.color,
            subject: classroom.subject,
            role: "TEACHER",
            memberCount: classroom._count.members,
        }, { status: 201 });
    } catch (e) {
        console.error("POST /api/classrooms", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
