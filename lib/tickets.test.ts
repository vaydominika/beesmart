import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveTicketCount, getUserTickets, ticketStatusNotification } from "./tickets";
import { prisma } from "./db";

vi.mock("./db", () => ({
  prisma: {
    report: { findMany: vi.fn(), count: vi.fn() },
  },
}));

describe("ticket queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes My Reports to the owner and excludes automated flags", async () => {
    vi.mocked(prisma.report.findMany).mockResolvedValue([]);
    await getUserTickets("user-1");
    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", type: { in: ["COURSE_REPORT", "EARLY_ACCESS_FEEDBACK"] } },
    }));
  });

  it("counts only active user-submitted tickets", async () => {
    vi.mocked(prisma.report.count).mockResolvedValue(2);
    expect(await getActiveTicketCount("user-1")).toBe(2);
    expect(prisma.report.count).toHaveBeenCalledWith({ where: {
      userId: "user-1",
      type: { in: ["COURSE_REPORT", "EARLY_ACCESS_FEEDBACK"] },
      status: { in: ["OPEN", "IN_PROGRESS"] },
    } });
  });

  it("uses terminal status wording for resolved tickets", () => {
    expect(ticketStatusNotification("RESOLVED")).toEqual({ title: "Report resolved", body: "Your report is now resolved." });
  });
});
