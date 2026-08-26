import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  test: { findUnique: mocks.findUnique },
  event: { deleteMany: mocks.deleteMany, upsert: mocks.upsert },
} }));

import { syncTestCalendarEvent } from "./classroom-test-sync";

describe("syncTestCalendarEvent", () => {
  beforeEach(() => mocks.upsert.mockResolvedValue({ id: "event-1" }));

  it("does nothing for missing or non-classroom tests", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "test-1", classroomId: null });
    await expect(syncTestCalendarEvent("missing")).resolves.toBeNull();
    await expect(syncTestCalendarEvent("test-1")).resolves.toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("removes stale events when a test has no opening time", async () => {
    mocks.findUnique.mockResolvedValue({ id: "test-1", classroomId: "classroom-1", opensAt: null });
    await expect(syncTestCalendarEvent("test-1")).resolves.toBeNull();
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { testId: "test-1" } });
  });

  it("upserts a protected exam event with derived times", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "test-1", classroomId: "classroom-1", title: "Final", description: "Desc", type: "EXAM",
      opensAt: new Date(2026, 7, 26, 9, 5), closesAt: new Date(2026, 7, 26, 10, 30),
    });
    await syncTestCalendarEvent("test-1");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { testId: "test-1" },
      create: expect.objectContaining({ title: "Exam: Final", startTime: "09:05", endTime: "10:30", isProtected: true }),
      update: expect.objectContaining({ color: null }),
    }));
  });
});
