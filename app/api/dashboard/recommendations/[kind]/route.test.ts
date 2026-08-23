import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserId } from "@/lib/db";
import {
  CourseRecommendationError,
  getDailyCourseRecommendation,
} from "@/lib/ai/course-recommendations";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/ai/course-recommendations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/course-recommendations")>();
  return { ...actual, getDailyCourseRecommendation: vi.fn() };
});

const context = (kind: string) => ({ params: Promise.resolve({ kind }) });

describe("POST /api/dashboard/recommendations/[kind]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost"), context("HIVE_PICK"));

    expect(response.status).toBe(401);
    expect(getDailyCourseRecommendation).not.toHaveBeenCalled();
  });

  it("rejects unknown recommendation types", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");

    const response = await POST(new Request("http://localhost"), context("RANDOM"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_RECOMMENDATION_KIND" });
  });

  it("returns the user's stable daily recommendation", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getDailyCourseRecommendation).mockResolvedValue({
      kind: "HIVE_PICK",
      generatedAt: "2026-08-22T12:00:00.000Z",
      resetsAt: "2026-08-23T00:00:00.000Z",
      cached: true,
      course: { id: "course-1", title: "Biology II", description: "Cells", coverImageUrl: null, averageRating: 4.5 },
    });

    const response = await POST(new Request("http://localhost"), context("HIVE_PICK"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getDailyCourseRecommendation).toHaveBeenCalledWith("user-1", "HIVE_PICK");
  });

  it("returns protected eligibility states without exposing internals", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getDailyCourseRecommendation).mockRejectedValue(
      new CourseRecommendationError("COURSE_COMPLETION_REQUIRED", 409, "Finish one course to unlock daily course picks."),
    );

    const response = await POST(new Request("http://localhost"), context("TRY_SOMETHING_NEW"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Finish one course to unlock daily course picks.",
      code: "COURSE_COMPLETION_REQUIRED",
    });
  });
});
