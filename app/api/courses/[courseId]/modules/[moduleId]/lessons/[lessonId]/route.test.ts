import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety, flagContent } from "@/lib/ai/moderation";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    courseLesson: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/course-access", () => ({ canManageCourse: vi.fn().mockResolvedValue(true), getLessonAccess: vi.fn() }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn(), flagContent: vi.fn() }));

const context = { params: Promise.resolve({ courseId: "course-1", moduleId: "module-1", lessonId: "lesson-1" }) };

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
