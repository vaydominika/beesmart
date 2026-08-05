import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    courseFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

const context = { params: Promise.resolve({ courseId: "course-1", fileId: "file-1" }) };

function request(isVisible: unknown) {
  return new NextRequest("http://localhost/api/courses/course-1/files/file-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isVisible }),
  });
}

describe("PATCH /api/courses/[courseId]/files/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("owner-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ createdById: "owner-1" } as never);
    vi.mocked(prisma.courseFile.findUnique).mockResolvedValue({
      id: "file-1",
      courseId: "course-1",
      lesson: null,
    } as never);
    vi.mocked(prisma.courseFile.update).mockResolvedValue({
      id: "file-1",
      fileName: "diagram.png",
      fileUrl: "/uploads/diagram.png",
      fileSize: 1200,
      isVisible: false,
    } as never);
  });

  it("lets the course owner change attachment visibility", async () => {
    const response = await PATCH(request(false), context);
    expect(response.status).toBe(200);
    expect(prisma.courseFile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "file-1" },
      data: { isVisible: false },
    }));
  });

  it("rejects non-owners", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ createdById: "other-user" } as never);
    const response = await PATCH(request(false), context);
    expect(response.status).toBe(403);
    expect(prisma.courseFile.update).not.toHaveBeenCalled();
  });

  it("rejects files that do not belong to the course", async () => {
    vi.mocked(prisma.courseFile.findUnique).mockResolvedValue({
      id: "file-1",
      courseId: "course-2",
      lesson: null,
    } as never);
    const response = await PATCH(request(true), context);
    expect(response.status).toBe(404);
    expect(prisma.courseFile.update).not.toHaveBeenCalled();
  });
});
