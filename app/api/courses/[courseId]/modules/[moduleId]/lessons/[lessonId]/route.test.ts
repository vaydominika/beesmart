import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety, flagContent } from "@/lib/ai/moderation";
import { canManageCourse, getLessonAccess } from "@/lib/course-access";
import { markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    courseLesson: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/course-access", () => ({ canManageCourse: vi.fn().mockResolvedValue(true), getLessonAccess: vi.fn() }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn(), flagContent: vi.fn() }));
vi.mock("@/lib/files/lifecycle", () => ({ markFilesForDeletion: vi.fn(), purgeStoredFiles: vi.fn() }));

const context = routeContext({ courseId: "course-1", moduleId: "module-1", lessonId: "lesson-1" });

describe("lesson update hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({ id: "lesson-1" } as never);
    vi.mocked(prisma.courseLesson.update).mockResolvedValue({
      id: "lesson-1", title: "Cells", content: "<p>Safe</p>", contentDraft: "<p>Safe</p>",
    } as never);
  });

  it("sanitizes stored HTML and awaits advisory moderation", async () => {
    let release!: (value: { safe: boolean; reason?: string }) => void;
    vi.mocked(checkContentSafety).mockReturnValue(new Promise((resolve) => { release = resolve; }));
    vi.mocked(flagContent).mockResolvedValue({ id: "report-1" } as never);

    let finished = false;
    const responsePromise = PATCH(new NextRequest("http://localhost/lesson", {
      method: "PATCH",
      body: JSON.stringify({ content: '<p onclick="bad()">Safe<script>bad()</script></p>' }),
    }), context).then((response) => { finished = true; return response; });

    await Promise.resolve();
    expect(finished).toBe(false);
    release({ safe: false, reason: "review" });
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(prisma.courseLesson.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { contentDraft: "<p>Safe</p>" },
    }));
    expect(flagContent).toHaveBeenCalledWith("teacher-1", "course-1", "MANUAL_CONTENT_UNSAFE", "review");
  });
});

describe("lesson detail operations", () => {
  const tx = { courseLesson: { delete: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(getLessonAccess).mockResolvedValue({ allowed: true, isCreator: true } as never);
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({ id: "lesson-1", files: [] } as never);
    vi.mocked(prisma.courseLesson.update).mockResolvedValue({ id: "lesson-1", title: "Cells", content: "", contentDraft: "" } as never);
    vi.mocked(checkContentSafety).mockResolvedValue({ safe: true });
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => unknown) => callback(tx)) as never);
    tx.courseLesson.delete.mockResolvedValue({ id: "lesson-1" });
  });

  it("requires authentication for read, update, and delete", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(401);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(401);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(401);
  });

  it("maps stored learner files to protected URLs", async () => {
    vi.mocked(getLessonAccess).mockResolvedValue({ allowed: true, isCreator: false } as never);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({
      id: "lesson-1", title: "Cells", files: [{ storedFileId: "stored-1", fileUrl: "/legacy" }],
    } as never);
    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body.files[0].fileUrl).toBe("/api/files/stored-1");
    expect(prisma.courseLesson.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.any(Object) }));
  });

  it("normalizes legacy Markdown lesson content for the viewer", async () => {
    vi.mocked(getLessonAccess).mockResolvedValue({ allowed: true, isCreator: false } as never);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({
      id: "lesson-1",
      title: "Cells",
      content: "## Cell structure\n\nCells have **membranes**.",
      files: [],
    } as never);

    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body.content).toBe("<h2>Cell structure</h2>\n<p>Cells have <strong>membranes</strong>.</p>");
  });

  it.each([
    ["COURSE_FORBIDDEN", 403],
    ["LESSON_LOCKED", 423],
    ["LESSON_NOT_FOUND", 404],
  ])("maps %s access failures to %i", async (reason, status) => {
    vi.mocked(getLessonAccess).mockResolvedValue({ allowed: false, reason, blockingLessonIds: ["previous"] } as never);
    const response = await GET(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(status);
    if (status === 423) await expect(response.json()).resolves.toMatchObject({ code: "LESSON_LOCKED", blockingLessonIds: ["previous"] });
  });

  it("returns 404 when an allowed lesson disappears", async () => {
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(404);
  });

  it("normalizes lesson metadata without invoking moderation", async () => {
    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH", body: JSON.stringify({ description: "  Intro  ", isLocked: true }),
    }), context);
    expect(response.status).toBe(200);
    expect(prisma.courseLesson.update).toHaveBeenCalledWith({ where: { id: "lesson-1" }, data: { description: "Intro", isLocked: true } });
    expect(checkContentSafety).not.toHaveBeenCalled();
  });

  it("enforces course, management, and scoped lesson checks before updates", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(404);
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(canManageCourse).mockResolvedValue(false);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(403);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue(null);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }), context)).status).toBe(404);
  });

  it("deletes lesson attachments transactionally", async () => {
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({
      id: "lesson-1", files: [{ storedFileId: "file-1" }, { storedFileId: null }],
    } as never);
    const response = await DELETE(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(markFilesForDeletion).toHaveBeenCalledWith(tx, ["file-1"]);
    expect(tx.courseLesson.delete).toHaveBeenCalledWith({ where: { id: "lesson-1" } });
    expect(purgeStoredFiles).toHaveBeenCalledWith(["file-1"]);
  });

  it("enforces existence and management checks before delete", async () => {
    vi.mocked(prisma.course.findUnique).mockResolvedValue(null);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(404);
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ id: "course-1" } as never);
    vi.mocked(canManageCourse).mockResolvedValue(false);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(403);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue(null);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(404);
  });
});
