import { NextRequest, NextResponse } from "next/server";
import { prisma, getCurrentUserId } from "@/lib/db";

type RouteContext = { params: Promise<{ courseId: string }> };

async function isCreator(courseId: string, userId: string) {
    return prisma.course.findFirst({ where: { id: courseId, createdById: userId }, select: { id: true } });
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { courseId } = await ctx.params;
    if (!await isCreator(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const grants = await prisma.courseAccess.findMany({
        where: { courseId },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(grants);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { courseId } = await ctx.params;
    if (!await isCreator(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { email } = await req.json();
    const invitedUser = await prisma.user.findUnique({ where: { email: email?.trim().toLowerCase() } });
    if (!invitedUser) return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
    const grant = await prisma.courseAccess.upsert({
        where: { courseId_userId: { courseId, userId: invitedUser.id } },
        update: { invitedById: userId },
        create: { courseId, userId: invitedUser.id, invitedById: userId },
    });
    await prisma.notification.create({
        data: {
            userId: invitedUser.id, title: "Course invitation", body: "You can now access an invitation-only course.",
            type: "INVITATION", category: "GENERAL", relatedId: courseId, relatedType: "course",
            actionUrl: `/courses/${courseId}`,
        },
    });
    return NextResponse.json(grant, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { courseId } = await ctx.params;
    if (!await isCreator(courseId, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const targetUserId = req.nextUrl.searchParams.get("userId");
    if (!targetUserId) return NextResponse.json({ error: "User ID required" }, { status: 400 });
    await prisma.courseAccess.deleteMany({ where: { courseId, userId: targetUserId } });
    return NextResponse.json({ success: true });
}

