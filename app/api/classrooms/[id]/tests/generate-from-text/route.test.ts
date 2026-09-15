import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { generateObject } from "ai";
import { getCurrentUserId, prisma } from "@/lib/db";
import { checkContentSafety } from "@/lib/ai/moderation";
import { reserveAiAttempt } from "@/lib/ai/usage";
import { extractTextFromFile } from "@/lib/ai/file-utils";
import { validateUpload } from "@/lib/files/validation";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { classroomMember: { findUnique: vi.fn() } },
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn() }));
vi.mock("@/lib/ai/moderation", () => ({ checkContentSafety: vi.fn() }));
vi.mock("@/lib/ai/file-utils", () => ({ extractTextFromFile: vi.fn() }));
vi.mock("@/lib/files/scanner", () => ({
  MalwareScanError: class MalwareScanError extends Error {},
  scanForMalware: vi.fn().mockResolvedValue("CLEAN"),
}));
vi.mock("@/lib/files/validation", () => ({
  UploadValidationError: class UploadValidationError extends Error {
    status = 400;
  },
  validateUpload: vi.fn(),
}));
vi.mock("@/lib/ai/usage", () => ({
  AiDailyLimitError: class AiDailyLimitError extends Error {},
  reserveAiAttempt: vi.fn().mockResolvedValue({ category: "TEST_EXAM", used: 1, remaining: 2, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" }),
  withAiUsage: vi.fn((response) => response),
  aiLimitResponse: vi.fn(),
}));

const context = routeContext({ id: "class-1" });
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
    vi.mocked(extractTextFromFile).mockResolvedValue("Photosynthesis stores light energy as chemical energy in plant cells.");
    vi.mocked(validateUpload).mockResolvedValue({
      originalName: "biology.txt",
      detectedMime: "text/plain",
      extension: "txt",
      fileType: "OTHER",
      size: 15,
      buffer: Buffer.from("source material"),
    });
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        title: "Photosynthesis quiz",
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

  it("rejects text over 12,000 characters before reserving an attempt", async () => {
    expect((await POST(request({ sourceText: "x".repeat(12_001) }), context)).status).toBe(400);
    expect(reserveAiAttempt).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns an unlinked editable test draft", async () => {
    const response = await POST(request({ sourceText, difficulty: "Intermediate", questionCount: 5 }), context);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.test.title).toBe("Photosynthesis quiz");
    expect(data).not.toHaveProperty("courseId");
    expect(checkContentSafety).toHaveBeenCalledTimes(2);
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 4000 }));
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.not.stringContaining("Description:"),
    }));
  });

  it("extracts ephemeral source files for generation", async () => {
    const formData = new FormData();
    formData.append("files", new File(["source material"], "biology.txt", { type: "text/plain" }));
    formData.append("files", new File(["more source material"], "plants.txt", { type: "text/plain" }));
    formData.append("difficulty", "Advanced");
    formData.append("questionCount", "3");

    const multipartRequest = {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;
    const response = await POST(multipartRequest, context);

    expect(response.status).toBe(200);
    expect(validateUpload).toHaveBeenCalledTimes(2);
    expect(extractTextFromFile).toHaveBeenCalledTimes(2);
    expect(extractTextFromFile).toHaveBeenCalledWith(expect.objectContaining({ name: "biology.txt" }));
    expect(checkContentSafety).toHaveBeenNthCalledWith(1, expect.stringContaining("chemical energy"));
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("chemical energy"),
    }));
  });

  it("rejects unsafe source text before generation", async () => {
    vi.mocked(checkContentSafety).mockResolvedValueOnce({ safe: false, reason: "Unsafe" });
    expect((await POST(request({ sourceText }), context)).status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });
});
