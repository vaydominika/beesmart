import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(), memberFindUnique: vi.fn(), classroomFindUnique: vi.fn(),
  memberFindMany: vi.fn(), memberFindFirst: vi.fn(), memberUpdate: vi.fn(), memberDelete: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  prisma: {
    classroom: { findUnique: mocks.classroomFindUnique },
    classroomMember: {
      findUnique: mocks.memberFindUnique,
      findMany: mocks.memberFindMany,
      findFirst: mocks.memberFindFirst,
      update: mocks.memberUpdate,
      delete: mocks.memberDelete,
    },
  },
}));

import { DELETE, GET, PATCH } from "./route";

const context = { params: Promise.resolve({ id: "classroom-1" }) };
const request = (method: string, body: unknown) => new NextRequest("http://localhost", { method, body: JSON.stringify(body) });

describe("classroom members route", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockResolvedValue("teacher");
    mocks.memberFindUnique.mockResolvedValue({ id: "teacher-member", userId: "teacher", role: "TEACHER" });
  });

  it("lists members with owner and current-user flags", async () => {
    mocks.classroomFindUnique.mockResolvedValue({ createdById: "teacher" });
    mocks.memberFindMany.mockResolvedValue([
      { id: "m-1", userId: "teacher", role: "TEACHER", user: { id: "teacher" } },
      { id: "m-2", userId: "student", role: "STUDENT", user: { id: "student" } },
    ]);
    expect(await (await GET(new NextRequest("http://localhost"), context)).json()).toEqual([
      expect.objectContaining({ id: "m-1", isOwner: true, isCurrentUser: true }),
      expect.objectContaining({ id: "m-2", isOwner: false, isCurrentUser: false }),
    ]);
  });

  it("allows a teacher to change another non-owner member's role", async () => {
    mocks.memberFindFirst.mockResolvedValue({ id: "m-2", userId: "student", classroom: { createdById: "teacher" } });
    mocks.memberUpdate.mockResolvedValue({ id: "m-2", role: "TEACHING_ASSISTANT" });
    const response = await PATCH(request("PATCH", { memberId: "m-2", role: "TEACHING_ASSISTANT" }), context);
    expect(response.status).toBe(200);
    expect(mocks.memberUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m-2" }, data: { role: "TEACHING_ASSISTANT" } }));
  });

  it("rejects invalid, missing, owner, and self role changes", async () => {
    expect((await PATCH(request("PATCH", { memberId: "m-2", role: "OWNER" }), context)).status).toBe(400);
    mocks.memberFindFirst.mockResolvedValueOnce(null);
    expect((await PATCH(request("PATCH", { memberId: "missing", role: "STUDENT" }), context)).status).toBe(404);
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "owner", userId: "teacher", classroom: { createdById: "teacher" } });
    expect((await PATCH(request("PATCH", { memberId: "owner", role: "STUDENT" }), context)).status).toBe(400);
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "self", userId: "teacher", classroom: { createdById: "someone-else" } });
    expect((await PATCH(request("PATCH", { memberId: "self", role: "STUDENT" }), context)).status).toBe(400);
  });

  it("removes a non-owner member while protecting missing, owner, and self targets", async () => {
    expect((await DELETE(request("DELETE", {}), context)).status).toBe(400);
    mocks.memberFindFirst.mockResolvedValueOnce(null);
    expect((await DELETE(request("DELETE", { memberId: "missing" }), context)).status).toBe(404);
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "owner", userId: "teacher", classroom: { createdById: "teacher" } });
    expect((await DELETE(request("DELETE", { memberId: "owner" }), context)).status).toBe(400);
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "self", userId: "teacher", classroom: { createdById: "someone-else" } });
    expect((await DELETE(request("DELETE", { memberId: "self" }), context)).status).toBe(400);
    mocks.memberFindFirst.mockResolvedValueOnce({ id: "m-2", userId: "student", classroom: { createdById: "teacher" } });
    expect((await DELETE(request("DELETE", { memberId: "m-2" }), context)).status).toBe(200);
    expect(mocks.memberDelete).toHaveBeenCalledWith({ where: { id: "m-2" } });
  });

  it("rejects non-teachers before mutating members", async () => {
    mocks.memberFindUnique.mockResolvedValue({ role: "STUDENT" });
    expect((await PATCH(request("PATCH", { memberId: "m-2", role: "STUDENT" }), context)).status).toBe(403);
    expect((await DELETE(request("DELETE", { memberId: "m-2" }), context)).status).toBe(403);
  });
});
