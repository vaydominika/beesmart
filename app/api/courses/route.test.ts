import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import { claimUploads } from "@/lib/files/lifecycle";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findMany: vi.fn(), create: vi.fn() },
    courseProgress: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));
vi.mock("@/lib/files/lifecycle", () => ({
  claimUploads: vi.fn(),
  UploadClaimError: class UploadClaimError extends Error {},
}));

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

  it("uses the full access predicate for source=all", async () => {
    await GET(new NextRequest("http://localhost/api/courses?source=all"));
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [expect.objectContaining({ OR: expect.any(Array) })] },
    }));
  });

  it("maps owned, empty courses without progress or classrooms", async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([{
      ...record, id: "owned", createdById: "learner-1", classroomId: null, classroom: null,
      classroomLinks: [], modules: [], enrollments: [], coverStoredFileId: "cover-1",
    }] as never);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([]);
    const body = await (await GET(new NextRequest("http://localhost/api/courses"))).json();
    expect(body[0]).toMatchObject({ relationship: "owner", isEnrolled: false, progress: 0, lastAccessedAt: null, lessonCount: 0, classrooms: [], coverImageUrl: "/api/files/cover-1" });
  });

  it("keeps the most recent progress timestamp", async () => {
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([
      { courseId: "course-1", lessonId: "lesson-1", completedAt: null, lastAccessedAt: new Date("2026-08-01") },
      { courseId: "course-1", lessonId: "lesson-2", completedAt: new Date(), lastAccessedAt: new Date("2026-08-05") },
    ] as never);
    const body = await (await GET(new NextRequest("http://localhost/api/courses"))).json();
    expect(body[0].progress).toBe(50);
    expect(body[0].lastAccessedAt).toBe("2026-08-05T00:00:00.000Z");
  });

  it("logs and hides database read failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(prisma.course.findMany).mockRejectedValue(new Error("secret connection"));
    const response = await GET(new NextRequest("http://localhost/api/courses"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Server error" });
    expect(error).toHaveBeenCalledWith("GET /api/courses", expect.any(Error));
    error.mockRestore();
  });
});

describe("POST /api/courses tutorial prerequisite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ courseCreationTutorialCompleted: true } as never);
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

  it("requires authentication and a non-empty title", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await POST(new NextRequest("http://localhost", { method: "POST", body: "{}" }))).status).toBe(401);
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    expect((await POST(new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ title: "   " }) }))).status).toBe(400);
  });

  it("creates a public course with claimed cover and attachments", async () => {
    const tx = { course: { create: vi.fn().mockResolvedValue({ id: "course-1", title: "Biology" }) } };
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => unknown) => callback(tx)) as never);
    vi.mocked(claimUploads)
      .mockResolvedValueOnce([{ id: "attachment-1", originalName: "lesson.pdf", size: 42, fileType: "application/pdf" }] as never)
      .mockResolvedValueOnce([{ id: "cover-1" }] as never);

    const response = await POST(new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "  Biology  ", description: "  Cells  ", classroomId: "class-1", isPublic: false,
        visibility: "PUBLIC", published: true, uploadIds: ["attachment-1"], coverUploadId: "cover-1",
      }),
    }));
    expect(response.status).toBe(200);
    expect(tx.course.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      title: "Biology", description: "Cells", classroomId: "class-1", isPublic: true, visibility: "PUBLIC",
      published: true, coverStoredFileId: "cover-1", createdById: "user-1", files: expect.any(Object),
    }) });
    expect(recordMeaningfulActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "COURSE_CREATED" }));
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ title: "Course created", relatedId: "course-1" }) });
  });

  it("uses legacy visibility defaults and omits empty attachments", async () => {
    const tx = { course: { create: vi.fn().mockResolvedValue({ id: "course-2", title: "Private" }) } };
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => unknown) => callback(tx)) as never);
    vi.mocked(claimUploads).mockResolvedValue([]);
    await POST(new NextRequest("http://localhost", {
      method: "POST", body: JSON.stringify({ title: "Private", isPublic: false, uploadIds: "bad", coverUploadId: null }),
    }));
    expect(tx.course.create).toHaveBeenCalledWith({ data: {
      title: "Private", description: null, classroomId: null, isPublic: false, visibility: "PRIVATE",
      published: false, coverStoredFileId: null, createdById: "user-1",
    } });
  });
});
