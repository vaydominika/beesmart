import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getCurrentUserId, prisma } from "@/lib/db";
import { canManageCourse } from "@/lib/course-access";
import { reserveAiAttempt } from "@/lib/ai/usage";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    course: { findUnique: vi.fn() },
    courseLesson: { findFirst: vi.fn() },
    storedFile: { create: vi.fn() },
  },
}));
vi.mock("@/lib/course-access", () => ({ canManageCourse: vi.fn() }));
vi.mock("ai", () => ({ streamText: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn().mockResolvedValue({ safe: true }), flagContent: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({
  AiDailyLimitError: class AiDailyLimitError extends Error {},
  reserveAiAttempt: vi.fn().mockResolvedValue({ category: "LESSON_CONTENT", used: 1, remaining: 2, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" }),
  aiUsageHeaders: vi.fn(() => ({ "X-AI-Remaining": "2" })),
  withAiUsage: vi.fn((response) => response),
  aiLimitResponse: vi.fn(),
}));

const context = { params: Promise.resolve({ courseId: "course-1", lessonId: "lesson-1" }) };

describe("POST lesson generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ createdById: "teacher-1" } as never);
    vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({ id: "lesson-1", title: "Cells", module: { title: "Biology" } } as never);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(streamText).mockReturnValue({ toTextStreamResponse: (init?: ResponseInit) => new Response("Generated lesson", init) } as never);
  });

  it("rejects prompts over 2,000 characters before consuming an attempt", async () => {
    const response = await POST(new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "x".repeat(2_001) }),
    }), context);

    expect(response.status).toBe(400);
    expect(reserveAiAttempt).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("reserves once and applies the lesson output ceiling", async () => {
    const response = await POST(new NextRequest("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Explain cell structure" }),
    }), context);

    expect(response.status).toBe(200);
    expect(reserveAiAttempt).toHaveBeenCalledOnce();
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 3000 }));
    expect(response.headers.get("X-AI-Remaining")).toBe("2");
  });
});
