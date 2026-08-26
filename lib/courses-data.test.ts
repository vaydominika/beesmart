import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUserId, prisma } from "@/lib/db";
import { getActiveTicketCount } from "@/lib/tickets";
import {
  getContinueLearningForUser,
  getCurrentUserById,
  getDashboardData,
  getDiscoverCoursesForUser,
  getMyCoursesForUser,
  getPopularCourses,
  getStreakForUser,
} from "./courses-data";

vi.mock("@/lib/tickets", () => ({ getActiveTicketCount: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findMany: vi.fn() },
    courseEnrollment: { findMany: vi.fn() },
    courseProgress: { findMany: vi.fn() },
    streak: { findUnique: vi.fn() },
  },
}));

const course = (overrides: Record<string, unknown> = {}) => ({
  id: "course-1",
  title: "TypeScript",
  description: "Learn types",
  coverImageUrl: "/legacy.png",
  coverStoredFileId: null,
  ratings: [],
  enrollments: [],
  modules: [],
  ...overrides,
});

describe("course dashboard data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([]);
    vi.mocked(prisma.course.findMany).mockResolvedValue([]);
    vi.mocked(prisma.streak.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(getActiveTicketCount).mockResolvedValue(0);
  });

  it("leaves the avatar empty when only a provider placeholder exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Ada",
      avatar: null,
      bannerImageUrl: "/banner.png",
    } as never);

    await expect(getCurrentUserById("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Ada",
      avatar: null,
      bannerImageUrl: "/banner.png",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        name: true,
        avatar: true,
        bannerImageUrl: true,
      },
    });
  });

  it("returns null for a missing user and zero for a missing streak", async () => {
    await expect(getCurrentUserById("missing")).resolves.toBeNull();
    await expect(getStreakForUser("user-1")).resolves.toBe(0);
    expect(prisma.streak.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" }, select: { currentStreak: true } });
  });

  it("calculates enrollment progress, rating, and private cover URLs", async () => {
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([{
      course: course({
        coverStoredFileId: "cover-1",
        modules: [{ lessons: [{ id: "lesson-1" }, { id: "lesson-2" }] }],
        ratings: [{ rating: 4 }, { rating: 5 }],
      }),
    }] as never);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([
      { lessonId: "lesson-1", completedAt: new Date() },
      { lessonId: "lesson-2", completedAt: null },
    ] as never);

    await expect(getContinueLearningForUser("user-1")).resolves.toEqual([expect.objectContaining({
      id: "course-1", progress: 50, averageRating: 4.5, coverImageUrl: "/api/files/cover-1",
    })]);
  });

  it("handles an empty enrolled course without division by zero", async () => {
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([{ course: course() }] as never);
    await expect(getContinueLearningForUser("user-1")).resolves.toEqual([expect.objectContaining({ progress: 0, averageRating: null })]);
  });

  it("sorts popular public courses by rating and enrollment count", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    vi.mocked(prisma.course.findMany).mockResolvedValue([
      course({ id: "low", ratings: [{ rating: 3 }], enrollments: new Array(10) }),
      course({ id: "popular", ratings: [{ rating: 5 }, { rating: 4 }], enrollments: [] }),
      course({ id: "tie", ratings: [{ rating: 4.5 }], enrollments: new Array(2) }),
      course({ id: "unrated", ratings: [], enrollments: [] }),
    ] as never);

    const result = await getPopularCourses();
    expect(result.map((item) => item.id)).toEqual(["tie", "popular", "low", "unrated"]);
    expect(result[0].averageRating).toBe(4.5);
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isPublic: true, published: true, createdById: undefined }),
      take: 12,
    }));
  });

  it("excludes the signed-in user's enrolled and owned courses from popular results", async () => {
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([{ courseId: "enrolled-1" }] as never);
    vi.mocked(prisma.course.findMany).mockImplementation((async (args: any) => {
      if (args.where?.id?.in) return [{ id: "enrolled-1", modules: [{ lessons: [{ id: "lesson-1" }] }] }] as never;
      return [course({ id: "new-course", ratings: [{ rating: 4 }], enrollments: [] })] as never;
    }) as never);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([{ lessonId: "lesson-1", completedAt: new Date(), courseId: "enrolled-1" }] as never);

    await getPopularCourses();
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { notIn: ["enrolled-1"] }, createdById: { not: "user-1" } }),
    }));
  });

  it("maps discover and authored courses with rounded ratings", async () => {
    vi.mocked(prisma.courseEnrollment.findMany).mockResolvedValue([{ courseId: "joined" }] as never);
    vi.mocked(prisma.course.findMany).mockResolvedValueOnce([
      course({ id: "discover", coverStoredFileId: "cover-2", ratings: [{ rating: 4 }, { rating: 3 }] }),
    ] as never);
    await expect(getDiscoverCoursesForUser("user-1")).resolves.toEqual([expect.objectContaining({
      id: "discover", averageRating: 3.5, coverImageUrl: "/api/files/cover-2",
    })]);
    expect(prisma.course.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { notIn: ["joined"] }, createdById: { not: "user-1" } }),
    }));

    vi.mocked(prisma.course.findMany).mockResolvedValueOnce([course({ id: "mine", ratings: [] })] as never);
    await expect(getMyCoursesForUser("user-1")).resolves.toEqual([expect.objectContaining({ id: "mine", averageRating: null })]);
  });

  it("assembles authenticated dashboard data, deduplicating and moving completed courses", async () => {
    vi.mocked(prisma.courseEnrollment.findMany).mockImplementation((async (args: any) => {
      if (args.include) return [{ course: course({ id: "complete", modules: [{ lessons: [{ id: "lesson-1" }] }] }) }] as never;
      return [] as never;
    }) as never);
    vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([{ lessonId: "lesson-1", completedAt: new Date() }] as never);
    vi.mocked(prisma.course.findMany).mockImplementation((async (args: any) => {
      if (args.where?.createdById === "user-1") return [course({ id: "complete" }), course({ id: "draft" })] as never;
      return [] as never;
    }) as never);
    vi.mocked(prisma.streak.findUnique).mockResolvedValue({ currentStreak: 7 } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", name: "Ada", avatar: null, bannerImageUrl: null } as never);
    vi.mocked(getActiveTicketCount).mockResolvedValue(2);

    const result = await getDashboardData();
    expect(result.continueLearning).toEqual([]);
    expect(result.finishedCourses).toEqual([expect.objectContaining({ id: "complete", progress: 100 })]);
    expect(result.myCourses.map((item) => item.id)).toEqual(["draft"]);
    expect(result).toMatchObject({ streak: 7, activeTicketCount: 2, user: { id: "user-1", name: "Ada" } });
  });

  it("returns a guest dashboard without querying private data", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const result = await getDashboardData();
    expect(result).toMatchObject({ continueLearning: [], discoverCourses: [], myCourses: [], finishedCourses: [], streak: 0, user: null });
    expect(getActiveTicketCount).not.toHaveBeenCalled();
  });
});
