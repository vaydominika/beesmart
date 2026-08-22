import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

const tx = { report: { create: vi.fn() }, notification: { create: vi.fn() } };

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const context = routeContext({ courseId: "course-1" });

describe("POST course report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
    tx.report.create.mockResolvedValue({ id: "ticket-1", type: "COURSE_REPORT" });
    tx.notification.create.mockResolvedValue({});
    // Prisma's overloaded transaction signature cannot preserve the lightweight test client type.
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
  });

  it("creates a tracked course ticket and receipt notification", async () => {
    const request = new NextRequest("http://localhost/api/courses/course-1/report", {
      method: "POST",
      body: JSON.stringify({ reason: "Spam or advertising", description: "Repeated links" }),
    });
    const response = await POST(request, context);
    expect(await response.json()).toEqual({ ok: true, ticketId: "ticket-1" });
    expect(tx.report.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "COURSE_REPORT" }) });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actionUrl: "/tickets#ticket-1" }) });
  });
});
