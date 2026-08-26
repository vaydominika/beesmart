import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  materialize: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  prisma: { notification: {
    findMany: mocks.findMany,
    count: mocks.count,
    updateMany: mocks.updateMany,
    findFirst: mocks.findFirst,
    update: mocks.update,
  } },
}));
vi.mock("@/lib/notifications", () => ({ materializeDueReminderNotifications: mocks.materialize }));

import { GET, PATCH } from "./route";

function patch(body: unknown) {
  return PATCH(new NextRequest("http://localhost/api/notifications", { method: "PATCH", body: JSON.stringify(body) }));
}

describe("notifications route", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.materialize.mockResolvedValue([{ task: "Read" }]);
    mocks.findMany.mockResolvedValue([{ id: "n-1" }]);
    mocks.count.mockResolvedValue(1);
  });

  it("filters valid categories and returns the notification envelope", async () => {
    const response = await GET(new NextRequest("http://localhost/api/notifications?category=CLASSROOM"));
    expect(await response.json()).toEqual({ notifications: [{ id: "n-1" }], unreadCount: 1, triggeredReminders: [{ task: "Read" }] });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", category: "CLASSROOM" }, take: 50 }));
  });

  it("marks all matching notifications read", async () => {
    const response = await patch({ all: true, read: true, category: "GENERAL" });
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", category: "GENERAL", readAt: null } }));
  });

  it("validates and scopes individual notification updates", async () => {
    expect((await patch({})).status).toBe(400);
    mocks.findFirst.mockResolvedValueOnce(null);
    expect((await patch({ id: "missing" })).status).toBe(404);
    mocks.findFirst.mockResolvedValueOnce({ id: "n-1", userId: "user-1" });
    mocks.update.mockResolvedValueOnce({ id: "n-1", readAt: null });
    const response = await patch({ id: "n-1", read: false });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "n-1" }, data: { readAt: null } });
  });
});
