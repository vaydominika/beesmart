import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { generateObject } from "ai";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety } from "@/lib/ai/moderation";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { classroomMember: { findUnique: vi.fn() } },
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn() }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn() }));

const context = { params: Promise.resolve({ id: "class-1" }) };
const sourceText = "Photosynthesis converts light energy into chemical energy in plant cells.";
const request = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/classrooms/class-1/tests/generate-from-text", {
  method: "POST",
  body: JSON.stringify(body),
});

describe("POST generated test from text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(checkContentSafety).mockResolvedValue({ safe: true });
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: "Photosynthesis quiz",
        description: "Generated from notes",
        questions: [{ text: "What is converted?", type: "SHORT_ANSWER", points: 1, correctAnswer: "Light energy" }],
      },
    } as never);
  });

  it("rejects students", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    expect((await POST(request({ sourceText }), context)).status).toBe(403);
  });

  it("validates the pasted text length", async () => {
    expect((await POST(request({ sourceText: "Too short" }), context)).status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns an unlinked editable test draft", async () => {
    const response = await POST(request({ sourceText, difficulty: "Intermediate", questionCount: 5 }), context);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.test.title).toBe("Photosynthesis quiz");
    expect(data.courseId).toBeNull();
    expect(checkContentSafety).toHaveBeenCalledTimes(2);
  });

  it("rejects unsafe source text before generation", async () => {
    vi.mocked(checkContentSafety).mockResolvedValueOnce({ safe: false, reason: "Unsafe" });
    expect((await POST(request({ sourceText }), context)).status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });
});
