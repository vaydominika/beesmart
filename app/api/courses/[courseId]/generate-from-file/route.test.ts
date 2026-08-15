import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generateObject } from "ai";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety } from "@/lib/ai/moderation";
import { POST } from "./route";
import { canManageCourse } from "@/lib/course-access";
import { reserveAiAttempt } from "@/lib/ai/usage";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { course: { findUnique: vi.fn() } },
}));

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn(), flagContent: vi.fn() }));
vi.mock("@/lib/course-access", () => ({ canManageCourse: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({
  AiDailyLimitError: class AiDailyLimitError extends Error {},
  reserveAiAttempt: vi.fn().mockResolvedValue({ category: "SYLLABUS", used: 1, remaining: 2, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" }),
  withAiUsage: vi.fn((response) => response),
  aiLimitResponse: vi.fn(),
}));

const context = { params: Promise.resolve({ courseId: "course-1" }) };

describe("POST /api/courses/[courseId]/generate-from-file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.course.findUnique).mockResolvedValue({ createdById: "teacher-1" } as never);
    vi.mocked(canManageCourse).mockResolvedValue(true);
    vi.mocked(generateObject).mockResolvedValue({
      object: { modules: [{ title: "Cells", description: "Cell biology", lessons: [{ title: "Cell structure", description: "Organelles" }] }] },
    } as never);
    vi.mocked(checkContentSafety).mockResolvedValue({ safe: true } as never);
  });

  it("accepts pasted text without a file and includes it in the generation prompt", async () => {
    const formData = new FormData();
    formData.set("text", "Cell membranes control what enters and leaves a cell.");
    const request = new NextRequest("http://localhost/api/courses/course-1/generate-from-file", { method: "POST", body: formData });

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Cell membranes control what enters and leaves a cell."),
    }));
  });

  it("requires either source text or a file", async () => {
    const request = new NextRequest("http://localhost/api/courses/course-1/generate-from-file", { method: "POST", body: new FormData() });
    const response = await POST(request, context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Add source text or a file" });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("rejects oversized source text without consuming an attempt", async () => {
    const formData = new FormData();
    formData.set("text", "x".repeat(12_001));
    const request = new NextRequest("http://localhost/api/courses/course-1/generate-from-file", { method: "POST", body: formData });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(reserveAiAttempt).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
  });
});
