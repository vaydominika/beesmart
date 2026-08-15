import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findMany: vi.fn(), create: vi.fn() },
    courseProgress: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    userSettings: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const record = {
  id: "course-1",
  title: "Biology",
  description: "Cells",
  coverImageUrl: null,
  coverStoredFileId: null,
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

describe("POST /api/courses tutorial prerequisite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  });

  it("rejects course creation until the tutorial is completed", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const response = await POST(new NextRequest("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Blocked course" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toMatchObject({ code: "COURSE_TUTORIAL_REQUIRED" });
    expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { courseCreationTutorialCompleted: true },
    });
  });

  it("rejects course titles longer than 150 characters", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ courseCreationTutorialCompleted: true } as never);

    const response = await POST(new NextRequest("http://localhost/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A".repeat(151) }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Course title must be 150 characters or fewer." });
  });
});
