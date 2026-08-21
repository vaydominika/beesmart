import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/lib/generated/prisma";
import { prisma, getCurrentUserId } from "@/lib/db";
import { ticketReceivedNotification } from "@/lib/tickets";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const uid = await getCurrentUserId();
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "Not logged in" },
        { status: 401 }
      );
    }
    const body = await _request.json();
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : undefined;
    if (!reason) {
      return NextResponse.json(
        { ok: false, error: "Reason is required" },
        { status: 400 }
      );
    }
    const [course, user] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId } }),
      prisma.user.findUnique({ where: { id: uid } }),
    ]);
    if (!course || !user) {
      return NextResponse.json(
        { ok: false, error: "Course or user not found" },
        { status: 404 }
      );
    }
    const ticket = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.report.create({
        data: {
          userId: uid,
          courseId,
          type: "COURSE_REPORT",
          reason,
          description: description ?? null,
        },
      });
      const notice = ticketReceivedNotification(created.type);
      await tx.notification.create({
        data: {
          userId: uid,
          ...notice,
          type: "OTHER",
          category: "GENERAL",
          relatedId: created.id,
          relatedType: "report",
          actionUrl: `/tickets#${created.id}`,
        },
      });
      return created;
    });
    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (e) {
    console.error("POST /api/courses/[courseId]/report", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
