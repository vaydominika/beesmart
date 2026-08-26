import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canAccessCourse, canManageCourse } from "@/lib/course-access";
import { auditCourseForPublishing } from "@/lib/course-audit";
import { routeContext } from "@/test-utils/route-context";
import { recordMeaningfulActivity } from "@/lib/activity";
import { claimUploads, markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/course-access", () => ({ canAccessCourse: vi.fn(), canManageCourse: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));
vi.mock("@/lib/course-audit", () => ({
  auditCourseForPublishing: vi.fn(),
  CoursePublishAuditUnavailableError: class CoursePublishAuditUnavailableError extends Error {},
}));
vi.mock("@/lib/files/lifecycle", () => ({
  claimUploads: vi.fn(),
  markFilesForDeletion: vi.fn(),
  purgeStoredFiles: vi.fn(),
  UploadClaimError: class UploadClaimError extends Error {},
}));

const context = routeContext({ courseId: "course-1" });
const course = {
  id: "course-1",
  title: "Biology",
  description: "Cells and their structures.",
  createdById: "teacher-1",
  published: false,
  coverStoredFileId: null,
  modules: [{
    id: "module-1",
    title: "Cells",
    description: null,
    lessons: [{
      id: "lesson-1",
      title: "Cell structure",
      description: null,
      content: "<p>Old content</p>",
      contentDraft: "<p>Checked draft</p>",
    }],
  }],
};

describe("course publication safety gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course as never);
  });

  it("keeps the course unchanged when the audit blocks publication", async () => {
    vi.mocked(auditCourseForPublishing).mockResolvedValue({
      publishable: false,
      blockingIssues: [{ lessonId: "lesson-1", category: "CONTENT_SAFETY", reason: "Unsafe instructions." }],
    });

    const response = await PATCH(publishRequest(), context);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data).toMatchObject({ code: "COURSE_NOT_PUBLISHABLE", issues: [{ reason: "Unsafe instructions." }] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("audits every publish request and promotes checked lesson drafts atomically", async () => {
    vi.mocked(auditCourseForPublishing).mockResolvedValue({ publishable: true, blockingIssues: [] });
    const lessonUpdate = vi.fn().mockResolvedValue({});
    const courseUpdate = vi.fn().mockResolvedValue({ ...course, published: true });
    // Prisma's overloaded transaction signature cannot preserve the lightweight test client type.
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({
      courseLesson: { update: lessonUpdate },
      course: { update: courseUpdate },
    } as never));

    const response = await PATCH(publishRequest(), context);

    expect(response.status).toBe(200);
    expect(auditCourseForPublishing).toHaveBeenCalledOnce();
    expect(lessonUpdate).toHaveBeenCalledWith({
      where: { id: "lesson-1" },
      data: { content: "<p>Checked draft</p>" },
    });
    expect(courseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "course-1" },
      data: expect.objectContaining({ published: true }),
    }));
  });

  it("rejects course-title updates longer than 150 characters", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/courses/course-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A".repeat(151) }),
    }), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Course title must be 150 characters or fewer." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("course detail operations", () => {
  const tx = {
    course: { update: vi.fn(), delete: vi.fn() },
    courseLesson: { update: vi.fn() },
    storedFile: { findMany: vi.fn(), updateMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(canAccessCourse).mockResolvedValue(true);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(course as never);
    vi.mocked(claimUploads).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => unknown) => callback(tx)) as never);
    tx.course.update.mockResolvedValue({ id: "course-1", title: "Biology", published: false });
    tx.course.delete.mockResolvedValue({ id: "course-1" });
  });

  it("requires authentication for read, update, and delete", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(401);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(401);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(401);
  });

  it("returns a creator course with a protected cover URL", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      ...course, coverStoredFileId: "stored-cover", coverImageUrl: "/legacy.png", creator: { id: "teacher-1", name: "Ada" }, _count: { enrollments: 4 },
    } as never);
    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body).toMatchObject({ id: "course-1", isCreator: true, coverImageUrl: "/api/files/stored-cover" });
  });

  it("hides inaccessible courses from non-creators", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
    vi.mocked(canAccessCourse).mockResolvedValue(false);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(403);
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(404);
  });

  it("normalizes ordinary updates and records meaningful activity", async () => {
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ title: "  New biology  ", description: "  Updated  ", visibility: "PUBLIC", isPublic: false, published: false }),
    }), context);
    expect(response.status).toBe(200);
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: "course-1" },
      data: { title: "New biology", description: "Updated", isPublic: true, visibility: "PUBLIC", published: false },
    });
    expect(recordMeaningfulActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "COURSE_UPDATED", courseId: "course-1" }));
  });

  it("rejects missing titles, legacy cover URLs, and unauthorized managers", async () => {
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ title: "   " }) }), context)).status).toBe(400);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ coverImageUrl: "/unsafe.png" }) }), context)).status).toBe(400);
    vi.mocked(canManageCourse).mockResolvedValue(false);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(403);
  });

  it("claims a replacement cover and purges the previous file", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ ...course, coverStoredFileId: "old-cover" } as never);
    vi.mocked(claimUploads).mockResolvedValue([{ id: "new-cover" }] as never);
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH", body: JSON.stringify({ coverUploadId: "new-cover" }),
    }), context);
    expect(response.status).toBe(200);
    expect(claimUploads).toHaveBeenCalledWith(tx, ["new-cover"], "teacher-1", "COURSE_COVER");
    expect(markFilesForDeletion).toHaveBeenCalledWith(tx, ["old-cover"]);
    expect(purgeStoredFiles).toHaveBeenCalledWith(["old-cover"]);
  });

  it("collects every stored file before deleting a course", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue({
      createdById: "teacher-1", coverStoredFileId: "cover",
      files: [{ storedFileId: "course-file" }, { storedFileId: null }],
      modules: [{ lessons: [{ files: [{ storedFileId: "lesson-file" }, { storedFileId: null }] }] }],
    } as never);
    const response = await DELETE(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(markFilesForDeletion).toHaveBeenCalledWith(tx, ["cover", "course-file", "lesson-file"]);
    expect(tx.course.delete).toHaveBeenCalledWith({ where: { id: "course-1" } });
    expect(purgeStoredFiles).toHaveBeenCalledWith(["cover", "course-file", "lesson-file"]);
  });

  it("enforces existence and management rights before deletion", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(404);
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ createdById: "teacher-1", coverStoredFileId: null, files: [], modules: [] } as never);
    vi.mocked(canManageCourse).mockResolvedValue(false);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(403);
  });
});

function publishRequest() {
  return new NextRequest("http://localhost/api/courses/course-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published: true }),
  });
}
