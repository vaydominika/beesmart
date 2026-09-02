import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";
import { routeContext } from "@/test-utils/route-context";
import { PATCH } from "./route";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    courseModule: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    courseLesson: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/course-access", () => ({ canManageCourse: vi.fn() }));
vi.mock("@/lib/files/lifecycle", () => ({ markFilesForDeletion: vi.fn(), purgeStoredFiles: vi.fn() }));

const context = routeContext({ courseId: "course-1", moduleId: "module-1" });

describe("PATCH course module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(prisma.courseModule.findFirst).mockResolvedValue({ id: "module-1" } as never);
    vi.mocked(prisma.courseModule.findUnique).mockResolvedValue({ id: "module-1", lessons: [] } as never);
  });

  it("sets every lesson in the module as a prerequisite", async () => {
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrerequisite: true }),
    }), context);

    expect(response.status).toBe(200);
    expect(prisma.courseLesson.updateMany).toHaveBeenCalledWith({
      where: { moduleId: "module-1", module: { courseId: "course-1" } },
      data: { isLocked: true },
    });
    expect(prisma.courseModule.findUnique).toHaveBeenCalledWith({
      where: { id: "module-1", courseId: "course-1" },
      include: { lessons: true },
    });
  });

  it("rejects a non-boolean prerequisite value", async () => {
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrerequisite: "yes" }),
    }), context);

    expect(response.status).toBe(400);
    expect(prisma.courseLesson.updateMany).not.toHaveBeenCalled();
  });
});
