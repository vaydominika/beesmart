import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canAccessCourse } from "@/lib/course-access";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { courseEnrollment: { upsert: vi.fn() } },
}));
vi.mock("@/lib/course-access", () => ({ canAccessCourse: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const request = new NextRequest("http://localhost/api/courses/course-1/enroll", { method: "POST" });
const context = routeContext({ courseId: "course-1" });

describe("POST /api/courses/[courseId]/enroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(canAccessCourse).mockResolvedValue(true);
    vi.mocked(prisma.courseEnrollment.upsert).mockResolvedValue({ id: "enrollment-1" } as never);
  });

  it("rejects a course outside the shared access rule", async () => {
    vi.mocked(canAccessCourse).mockResolvedValue(false);
    const response = await POST(request, context);
    expect(response.status).toBe(403);
    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
  });

  it("enrolls a classroom member when shared access permits it", async () => {
    const response = await POST(request, context);
    expect(response.status).toBe(200);
    expect(canAccessCourse).toHaveBeenCalledWith("course-1", "user-1");
    expect(prisma.courseEnrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_courseId: { userId: "user-1", courseId: "course-1" } },
    }));
  });
});
