import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserId } from "@/lib/db";
import { getAiUsage } from "@/lib/ai/usage";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({ getAiUsage: vi.fn() }));

describe("GET /api/ai/usage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns independent category allowances", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getAiUsage).mockResolvedValue({
      resetsAt: "2026-08-16T00:00:00.000Z",
      categories: {
        LESSON_CONTENT: { category: "LESSON_CONTENT", used: 1, remaining: 2, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
        SYLLABUS: { category: "SYLLABUS", used: 2, remaining: 1, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
        TEST_EXAM: { category: "TEST_EXAM", used: 3, remaining: 0, limit: 3, resetsAt: "2026-08-16T00:00:00.000Z" },
        GRADING: { category: "GRADING", used: 32, remaining: 3, limit: 35, resetsAt: "2026-08-16T00:00:00.000Z" },
      },
    });

    const response = await GET();
    const data = await response.json();
    expect(data.categories.SYLLABUS.remaining).toBe(1);
    expect(data.categories.TEST_EXAM.remaining).toBe(0);
    expect(data.categories.GRADING.remaining).toBe(3);
  });
});
