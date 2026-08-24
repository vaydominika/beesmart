import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { syncAssignmentCalendarEvent } from "./classroom-assignment-sync";

vi.mock("@/lib/db", () => ({
  prisma: {
    assignedWork: { findUnique: vi.fn() },
    event: { upsert: vi.fn() },
  },
}));

describe("syncAssignmentCalendarEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a protected event linked to the assignment", async () => {
    vi.mocked(prisma.assignedWork.findUnique).mockResolvedValue({
      id: "assignment-1",
      title: "Essay",
      description: "Instructions",
      classroomId: "class-1",
      deadlineAt: new Date("2099-08-26T19:00:00.000Z"),
      deadlineTimeZone: "Europe/Budapest",
      deadlineHasTime: true,
    } as never);

    await syncAssignmentCalendarEvent("assignment-1");

    expect(prisma.event.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { assignmentId: "assignment-1" },
      create: expect.objectContaining({
        title: "Assignment: Essay",
        classroomId: "class-1",
        assignmentId: "assignment-1",
        isProtected: true,
        startTime: "21:00",
      }),
      update: expect.objectContaining({
        title: "Assignment: Essay",
        isProtected: true,
        startTime: "21:00",
      }),
    }));
  });
});
