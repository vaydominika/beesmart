import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    classroomPost: { findFirst: vi.fn() },
    comment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

const context = routeContext({ id: "class-1", postId: "post-1" });

describe("classroom post comment association", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ id: "member-1" } as never);
    vi.mocked(prisma.classroomPost.findFirst).mockResolvedValue({ id: "post-1" } as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({ id: "comment-1" } as never);
  });

  it("returns 404 when the post is not in the classroom", async () => {
    vi.mocked(prisma.classroomPost.findFirst).mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/comments"), context);
    expect(response.status).toBe(404);
    expect(prisma.comment.findMany).not.toHaveBeenCalled();
  });

  it("rejects an overlong comment", async () => {
    const response = await POST(new NextRequest("http://localhost/comments", {
      method: "POST", body: JSON.stringify({ content: "x".repeat(5001) }),
    }), context);
    expect(response.status).toBe(400);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it("rejects a parent from another post or a nested reply", async () => {
    vi.mocked(prisma.comment.findFirst).mockResolvedValue(null);
    const response = await POST(new NextRequest("http://localhost/comments", {
      method: "POST", body: JSON.stringify({ content: "Reply", parentId: "foreign-comment" }),
    }), context);
    expect(response.status).toBe(404);
    expect(prisma.comment.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-comment", postId: "post-1", submissionId: null, isPrivate: false, parentId: null },
      select: { id: true },
    });
  });

  it("creates a reply through validated post and parent relations", async () => {
    vi.mocked(prisma.comment.findFirst).mockResolvedValue({ id: "parent-1" } as never);
    const response = await POST(new NextRequest("http://localhost/comments", {
      method: "POST", body: JSON.stringify({ content: " Reply ", parentId: "parent-1" }),
    }), context);
    expect(response.status).toBe(201);
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        post: { connect: { id: "post-1" } },
        parent: { connect: { id: "parent-1" } },
        content: "Reply",
      }),
    }));
  });
});
