import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  CourseRecommendationError,
  getDailyCourseRecommendation,
} from "./course-recommendations";

const database = vi.hoisted(() => ({
  dailyCourseRecommendation: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  courseEnrollment: { findFirst: vi.fn(), findMany: vi.fn() },
  course: { findMany: vi.fn(), findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: database }));
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeRateLimit: vi.fn() }));

const now = new Date("2026-08-22T12:00:00.000Z");
const completedEnrollment = {
  course: {
    title: "Cell biology",
    description: "Cells and living systems",
    tags: [{ tag: { name: "Biology" } }],
    modules: [{ title: "Cells", lessons: [{ title: "Cell structure" }] }],
  },
};
const candidate = {
  id: "course-2",
  title: "Genetics",
  description: "Genes and inheritance",
  tags: [{ tag: { name: "Biology" } }],
};
const selectedCourse = {
  id: candidate.id,
  title: candidate.title,
  description: candidate.description,
  coverImageUrl: null,
  coverStoredFileId: null,
  ratings: [{ rating: 4 }, { rating: 5 }],
};

describe("daily AI course recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.dailyCourseRecommendation.findUnique.mockResolvedValue(null);
    database.dailyCourseRecommendation.findMany.mockResolvedValue([]);
    database.dailyCourseRecommendation.create.mockResolvedValue({ id: "recommendation-1" });
    database.dailyCourseRecommendation.update.mockResolvedValue({});
    database.dailyCourseRecommendation.deleteMany.mockResolvedValue({ count: 1 });
    database.courseEnrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
    database.courseEnrollment.findMany.mockResolvedValue([completedEnrollment]);
    database.course.findMany.mockResolvedValue([candidate]);
    database.course.findFirst.mockResolvedValue(selectedCourse);
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 0 });
    vi.mocked(generateObject).mockResolvedValue({ object: { courseId: candidate.id } } as never);
  });

  it("requires at least one genuinely completed course", async () => {
    database.courseEnrollment.findFirst.mockResolvedValue(null);

    await expect(getDailyCourseRecommendation("user-1", "HIVE_PICK", now)).rejects.toMatchObject({
      code: "COURSE_COMPLETION_REQUIRED",
      status: 409,
    });
    expect(database.courseEnrollment.findMany).not.toHaveBeenCalled();
    expect(database.course.findMany).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("protects users when no eligible public course remains", async () => {
    database.course.findMany.mockResolvedValue([]);

    await expect(getDailyCourseRecommendation("user-1", "HIVE_PICK", now)).rejects.toMatchObject({
      code: "NO_ELIGIBLE_COURSES",
      status: 404,
    });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns the same stored recommendation without another AI call", async () => {
    database.dailyCourseRecommendation.findUnique.mockResolvedValue({
      id: "recommendation-1",
      courseId: candidate.id,
      createdAt: new Date("2026-08-22T08:00:00.000Z"),
    });

    const result = await getDailyCourseRecommendation("user-1", "HIVE_PICK", now);

    expect(result).toMatchObject({ cached: true, course: { id: candidate.id, averageRating: 4.5 } });
    expect(generateObject).not.toHaveBeenCalled();
    expect(database.dailyCourseRecommendation.create).not.toHaveBeenCalled();
  });

  it("asks AI for one exact candidate and stores it for the day", async () => {
    const result = await getDailyCourseRecommendation("user-1", "TRY_SOMETHING_NEW", now);

    expect(result).toMatchObject({ cached: false, kind: "TRY_SOMETHING_NEW", course: { id: candidate.id } });
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("least topical overlap"),
    }));
    expect(database.dailyCourseRecommendation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "user-1", kind: "TRY_SOMETHING_NEW" }),
    }));
    expect(database.dailyCourseRecommendation.update).toHaveBeenCalledWith({
      where: { id: "recommendation-1" },
      data: { courseId: candidate.id },
    });
  });

  it("keeps the two daily cards distinct when another course is available", async () => {
    const differentCandidate = {
      id: "course-3",
      title: "Creative writing",
      description: "Build a short story",
      tags: [{ tag: { name: "Writing" } }],
    };
    database.course.findMany.mockResolvedValue([candidate, differentCandidate]);
    database.dailyCourseRecommendation.findMany
      .mockResolvedValueOnce([{ courseId: candidate.id }])
      .mockResolvedValueOnce([]);
    database.course.findFirst.mockResolvedValue({
      ...selectedCourse,
      id: differentCandidate.id,
      title: differentCandidate.title,
      description: differentCandidate.description,
    });
    vi.mocked(generateObject).mockResolvedValue({ object: { courseId: differentCandidate.id } } as never);

    const result = await getDailyCourseRecommendation("user-1", "TRY_SOMETHING_NEW", now);

    expect(result.course.id).toBe(differentCandidate.id);
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.not.stringContaining(`\"id\":\"${candidate.id}\"`),
    }));
  });

  it("throttles repeated generation failures before another AI call", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, limit: 3, remaining: 0, retryAfterSeconds: 60 });

    await expect(getDailyCourseRecommendation("user-1", "HIVE_PICK", now)).rejects.toMatchObject({
      code: "RECOMMENDATION_RATE_LIMITED",
      status: 429,
    });
    expect(generateObject).not.toHaveBeenCalled();
    expect(database.dailyCourseRecommendation.deleteMany).toHaveBeenCalledWith({
      where: { id: "recommendation-1", courseId: null },
    });
  });

  it("does not leave a reservation behind when AI is unavailable", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("offline"));

    await expect(getDailyCourseRecommendation("user-1", "HIVE_PICK", now)).rejects.toBeInstanceOf(CourseRecommendationError);
    expect(database.dailyCourseRecommendation.deleteMany).toHaveBeenCalledWith({
      where: { id: "recommendation-1", courseId: null },
    });
  });

  it("does not start a second generation while today's pick is pending", async () => {
    database.dailyCourseRecommendation.findUnique.mockResolvedValue({
      id: "recommendation-1",
      courseId: null,
      createdAt: new Date("2026-08-22T11:59:30.000Z"),
    });

    await expect(getDailyCourseRecommendation("user-1", "HIVE_PICK", now)).rejects.toMatchObject({
      code: "RECOMMENDATION_PENDING",
      status: 409,
    });
    expect(generateObject).not.toHaveBeenCalled();
  });
});
