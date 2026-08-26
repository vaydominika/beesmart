import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(), courseFindFirst: vi.fn(), accessFindMany: vi.fn(),
  userFindUnique: vi.fn(), accessUpsert: vi.fn(), notificationCreate: vi.fn(), accessDeleteMany: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  prisma: {
    course: { findFirst: mocks.courseFindFirst },
    courseAccess: { findMany: mocks.accessFindMany, upsert: mocks.accessUpsert, deleteMany: mocks.accessDeleteMany },
    user: { findUnique: mocks.userFindUnique },
    notification: { create: mocks.notificationCreate },
  },
}));

import { DELETE, GET, POST } from "./route";

const context = { params: Promise.resolve({ courseId: "course-1" }) };

describe("course access route", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockResolvedValue("teacher");
    mocks.courseFindFirst.mockResolvedValue({ id: "course-1" });
  });

  it("lists grants only for the course creator", async () => {
    mocks.accessFindMany.mockResolvedValue([{ id: "grant-1" }]);
    expect(await (await GET(new NextRequest("http://localhost"), context)).json()).toEqual([{ id: "grant-1" }]);
    mocks.courseFindFirst.mockResolvedValueOnce(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(403);
  });

  it("normalizes invitation email and creates the grant and notification", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "student" });
    mocks.accessUpsert.mockResolvedValue({ id: "grant-1" });
    const response = await POST(new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ email: " STUDENT@EXAMPLE.COM " }) }), context);
    expect(response.status).toBe(201);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { email: "student@example.com" } });
    expect(mocks.notificationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "student", actionUrl: "/courses/course-1" }) }));
  });

  it("returns not found for unknown invitees", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    expect((await POST(new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ email: "missing@example.com" }) }), context)).status).toBe(404);
  });

  it("requires a target and removes a scoped grant", async () => {
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(400);
    const response = await DELETE(new NextRequest("http://localhost?userId=student", { method: "DELETE" }), context);
    expect(response.status).toBe(200);
    expect(mocks.accessDeleteMany).toHaveBeenCalledWith({ where: { courseId: "course-1", userId: "student" } });
  });
});
