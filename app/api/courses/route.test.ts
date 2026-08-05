import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findMany: vi.fn(), create: vi.fn() },
    courseProgress: { findMany: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const record = {
  id: "course-1",
  title: "Biology",
  description: "Cells",
  coverImageUrl: null,
  createdById: "teacher-1",
  classroomId: "classroom-1",
  isPublic: true,
  published: true,
  visibility: "PUBLIC",
  createdAt: new Date("2026-08-01T08:00:00.000Z"),
  updatedAt: new Date("2026-08-02T08:00:00.000Z"),
  creator: { id: "teacher-1", name: "Ada", avatar: null },
  _count: { modules: 1, enrollments: 4 },
  modules: [{ lessons: [{ id: "lesson-1" }, { id: "lesson-2" }] }],
  enrollments: [{ completedAt: null }],
  classroom: { id: "classroom-1", name: "Matematika" },
  classroomLinks: [{ classroom: { id: "classroom-1", name: "Matematika" } }],
};

describe("GET /api/courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("learner-1");
    vi.mocked(prisma.course.findMany).mockResolvedValue([record] as never);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([
      { courseId: "course-1", lessonId: "lesson-1", completedAt: new Date(), lastAccessedAt: new Date("2026-08-04T10:00:00.000Z") },
    ] as never);
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/courses"));
    expect(response.status).toBe(401);
  });

  it("serializes learner, enrollment, progress, lesson and deduplicated classroom metadata", async () => {
    const response = await GET(new NextRequest("http://localhost/api/courses"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data[0]).toMatchObject({
      relationship: "learner",
      isEnrolled: true,
      progress: 50,
      lessonCount: 2,
      classrooms: [{ id: "classroom-1", name: "Matematika" }],
    });
  });

  it("preserves source and search query compatibility", async () => {
    await GET(new NextRequest("http://localhost/api/courses?source=my&search=biology"));
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { createdById: "learner-1" },
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    }));
  });
});
