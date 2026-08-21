import { NextResponse } from "next/server";
import type { Prisma, ReportStatus } from "@/lib/generated/prisma";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUserId, prisma } from "@/lib/db";
import { REPORT_STATUS_OPTIONS, ticketStatusNotification } from "@/lib/tickets";

type RouteContext = { params: Promise<{ ticketId: string }> };

const VALID_STATUSES = new Set<ReportStatus>(REPORT_STATUS_OPTIONS.map((option) => option.value));

export async function PATCH(request: Request, context: RouteContext) {
  const adminId = await getCurrentUserId();
  if (!adminId || !await isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { ticketId } = await context.params;
  const body = await request.json();
  const status = body.status as ReportStatus;
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const current = await prisma.report.findUnique({ where: { id: ticketId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (current.status === status) return NextResponse.json(current);

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const report = await tx.report.update({
      where: { id: ticketId },
      data: { status, reviewedAt: new Date(), reviewedById: adminId },
    });
    if (report.type !== "AUTOMATED_COURSE_FLAG") {
      const notice = ticketStatusNotification(status);
      await tx.notification.create({
        data: {
          userId: report.userId,
          ...notice,
          type: "OTHER",
          category: "GENERAL",
          relatedId: report.id,
          relatedType: "report",
          actionUrl: `/tickets#${report.id}`,
        },
      });
    }
    return report;
  });

  return NextResponse.json(updated);
}
