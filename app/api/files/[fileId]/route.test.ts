import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canAccessCourse, canManageCourse } from "@/lib/course-access";
import { readPrivateFile } from "@/lib/files/storage";
import { isAdminUser } from "@/lib/admin";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { storedFile: { findUnique: vi.fn() }, classroomMember: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/course-access", () => ({ canAccessCourse: vi.fn(), canManageCourse: vi.fn(), getLessonAccess: vi.fn() }));
vi.mock("@/lib/files/storage", () => ({ readPrivateFile: vi.fn() }));
vi.mock("@/lib/admin", () => ({ isAdminUser: vi.fn() }));

const context = { params: Promise.resolve({ fileId: "stored-1" }) };
const base = {
  id: "stored-1", ownerId: "owner-1", state: "ATTACHED", scanStatus: "CLEAN",
  storageKey: "aa/00000000-0000-0000-0000-000000000000", detectedMime: "application/pdf",
  originalName: "lesson.pdf", fileType: "PDF", courseCover: null, courseFile: null, postFile: null, submissionFile: null, reportAttachment: null,
};

describe("protected file delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("viewer-1");
    vi.mocked(readPrivateFile).mockResolvedValue(Buffer.from("file"));
    vi.mocked(canManageCourse).mockResolvedValue(false);
    vi.mocked(canAccessCourse).mockResolvedValue(false);
    vi.mocked(isAdminUser).mockResolvedValue(false);
  });

  it("denies a hidden lesson file even when its ID is known", async () => {
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, courseFile: {
      courseId: "course-1", isVisible: false, course: { id: "course-1" }, lesson: null,
    } } as never);
    const response = await GET(new Request("http://localhost/api/files/stored-1"), context);
    expect(response.status).toBe(404);
    expect(readPrivateFile).not.toHaveBeenCalled();
  });

  it("denies a post file to a non-member", async () => {
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, postFile: { post: { classroomId: "class-1" } } } as never);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/file"), context)).status).toBe(404);
  });

  it("denies another student's submission to a student", async () => {
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, submissionFile: {
      submission: { userId: "other-student", assignedWork: { classroomId: "class-1" } },
    } } as never);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    expect((await GET(new Request("http://localhost/file"), context)).status).toBe(404);
  });

  it("streams a post file to a classroom member with hardened headers", async () => {
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, postFile: { post: { classroomId: "class-1" } } } as never);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    const response = await GET(new Request("http://localhost/file"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("only streams a ticket screenshot to its reporter or an admin", async () => {
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, reportAttachment: { report: { userId: "owner-1" } } } as never);
    expect((await GET(new Request("http://localhost/file"), context)).status).toBe(404);

    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, reportAttachment: { report: { userId: "viewer-1" } } } as never);
    expect((await GET(new Request("http://localhost/file"), context)).status).toBe(200);

    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue({ ...base, reportAttachment: { report: { userId: "owner-1" } } } as never);
    vi.mocked(isAdminUser).mockResolvedValue(true);
    expect((await GET(new Request("http://localhost/file"), context)).status).toBe(200);
  });
});
