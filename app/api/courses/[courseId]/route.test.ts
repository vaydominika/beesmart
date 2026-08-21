import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";
import { auditCourseForPublishing } from "@/lib/course-audit";
import { routeContext } from "@/test-utils/route-context";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function publishRequest() {
  return new NextRequest("http://localhost/api/courses/course-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published: true }),
  });
}
