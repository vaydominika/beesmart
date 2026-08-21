import type { ReportStatus, ReportType } from "@/lib/generated/prisma";

export const USER_REPORT_TYPES: ReportType[] = ["COURSE_REPORT", "EARLY_ACCESS_FEEDBACK"];
export const ACTIVE_REPORT_STATUSES: ReportStatus[] = ["OPEN", "IN_PROGRESS"];

export function earlyAccessFeedbackEnabled(value = process.env.NEXT_PUBLIC_EARLY_ACCESS_FEEDBACK_ENABLED) {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export const REPORT_STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
] as const satisfies ReadonlyArray<{ value: ReportStatus; label: string }>;

export function reportStatusLabel(status: ReportStatus) {
  return REPORT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function reportTypeLabel(type: ReportType) {
  if (type === "EARLY_ACCESS_FEEDBACK") return "Early Access feedback";
  if (type === "AUTOMATED_COURSE_FLAG") return "Automated course flag";
  return "Course report";
}
