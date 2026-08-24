import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { getCurrentUserId, prisma } from "@/lib/db";
import { PATCH } from "./route";
import { notifyClassroomMembers } from "@/lib/notifications";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    test: { findFirst: vi.fn(), update: vi.fn() },
    testAttempt: { aggregate: vi.fn() },
    classroomPost: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/classroom-test-sync", () => ({ syncTestCalendarEvent: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyClassroomMembers: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const context = routeContext({ id: "class-1", testId: "test-1" });

function patch(body: Record<string, unknown>) {
  return PATCH(new NextRequest("http://localhost/api/classrooms/class-1/tests/test-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

describe("PATCH test details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1",
      classroomId: "class-1",
      title: "Quiz",
      type: "TEST",
      opensAt: new Date("2099-08-26T08:00:00.000Z"),
      closesAt: new Date("2099-08-26T09:00:00.000Z"),
    } as never);
    vi.mocked(prisma.testAttempt.aggregate).mockResolvedValue({ _max: { attemptNumber: 1 } } as never);
    vi.mocked(prisma.test.update).mockResolvedValue({ id: "test-1", title: "Quiz", description: "Updated instructions", type: "TEST" } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("preserves an explicit zero passing score", async () => {
    const response = await patch({ passingScore: 0, timeLimit: 45, maxAttempts: 2 });
    expect(response.status).toBe(200);
    expect(prisma.test.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ passingScore: 0, timeLimit: 45, maxAttempts: 2 }),
    }));
    expect(prisma.classroomPost.updateMany).toHaveBeenCalledWith({
      where: { testId: "test-1" },
      data: { title: null, content: "Updated instructions", editedAt: expect.any(Date) },
    });
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({ recipientRoles: ["STUDENT"] }));
  });

  it("rejects invalid assessment limits", async () => {
    expect((await patch({ timeLimit: 0 })).status).toBe(400);
    expect((await patch({ passingScore: 101 })).status).toBe(400);
  });
});
