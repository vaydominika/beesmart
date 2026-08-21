import type { Prisma, ReportStatus, ReportType } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import {
  ACTIVE_REPORT_STATUSES,
  USER_REPORT_TYPES,
  reportStatusLabel,
} from "@/lib/ticket-types";

export {
  ACTIVE_REPORT_STATUSES,
  REPORT_STATUS_OPTIONS,
  USER_REPORT_TYPES,
  earlyAccessFeedbackEnabled,
  reportStatusLabel,
  reportTypeLabel,
} from "@/lib/ticket-types";

const attachmentSelect = {
  id: true,
  storedFile: {
    select: { id: true, originalName: true, detectedMime: true, size: true },
  },
} as const;

export type UserTicket = Prisma.ReportGetPayload<{
  include: {
    course: { select: { id: true; title: true } };
    attachments: { select: typeof attachmentSelect };
  };
}>;

export type AdminTicket = Prisma.ReportGetPayload<{
  include: {
    reporter: { select: { id: true; name: true; email: true } };
    reviewer: { select: { id: true; name: true; email: true } };
    course: { select: { id: true; title: true } };
    attachments: { select: typeof attachmentSelect };
  };
}>;

export async function getUserTickets(userId: string): Promise<UserTicket[]> {
  return prisma.report.findMany({
    where: { userId, type: { in: USER_REPORT_TYPES } },
    orderBy: { updatedAt: "desc" },
    include: {
      course: { select: { id: true, title: true } },
      attachments: { select: attachmentSelect },
    },
  });
}

export async function getAdminTickets(): Promise<AdminTicket[]> {
  return prisma.report.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
      attachments: { select: attachmentSelect },
    },
  });
}

export async function getActiveTicketCount(userId: string) {
  return prisma.report.count({
    where: {
      userId,
      type: { in: USER_REPORT_TYPES },
      status: { in: ACTIVE_REPORT_STATUSES },
    },
  });
}

export function ticketReceivedNotification(type: ReportType) {
  return {
    title: "Report received",
    body: type === "EARLY_ACCESS_FEEDBACK"
      ? "Your Early Access feedback is now open for review."
      : "Your course report is now open for review.",
  };
}

export function ticketStatusNotification(status: ReportStatus) {
  const label = reportStatusLabel(status);
  return {
    title: status === "RESOLVED" || status === "CLOSED" ? `Report ${label.toLowerCase()}` : "Report status updated",
    body: `Your report is now ${label.toLowerCase()}.`,
  };
}
