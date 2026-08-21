import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUserId, prisma } from "@/lib/db";
import { routeContext } from "@/test-utils/route-context";

const tx = { report: { update: vi.fn() }, notification: { create: vi.fn() } };

vi.mock("@/lib/admin", () => ({ isAdminUser: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { report: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));

const context = routeContext({ ticketId: "ticket-1" });
const request = (status: string) => new Request("http://localhost/api/admin/tickets/ticket-1", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status }),
});

describe("PATCH admin ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("admin-1");
    vi.mocked(isAdminUser).mockResolvedValue(true);
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: "ticket-1", userId: "user-1", type: "COURSE_REPORT", status: "OPEN" } as never);
    tx.report.update.mockResolvedValue({ id: "ticket-1", userId: "user-1", type: "COURSE_REPORT", status: "RESOLVED" });
    tx.notification.create.mockResolvedValue({});
    // Prisma's overloaded transaction signature cannot preserve the lightweight test client type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
  });

  it("conceals the endpoint from non-admins", async () => {
    vi.mocked(isAdminUser).mockResolvedValue(false);
    expect((await PATCH(request("RESOLVED"), context)).status).toBe(404);
    expect(prisma.report.findUnique).not.toHaveBeenCalled();
  });

  it("updates the reviewer and notifies the submitter", async () => {
    expect((await PATCH(request("RESOLVED"), context)).status).toBe(200);
    expect(tx.report.update).toHaveBeenCalledWith({ where: { id: "ticket-1" }, data: expect.objectContaining({ status: "RESOLVED", reviewedById: "admin-1" }) });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1", actionUrl: "/tickets#ticket-1" }) });
  });

  it("does not emit a notification when the status is unchanged", async () => {
    const response = await PATCH(request("OPEN"), context);
    expect(response.status).toBe(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
