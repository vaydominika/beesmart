import { deepseek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { plainTextExcerpt } from "@/lib/course-summary";
import { storedFileUrl } from "@/lib/files/types";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const courseRecommendationKindSchema = z.enum(["HIVE_PICK", "TRY_SOMETHING_NEW"]);
export type CourseRecommendationKind = z.infer<typeof courseRecommendationKindSchema>;

export type DailyCourseRecommendation = {
  kind: CourseRecommendationKind;
  generatedAt: string;
  resetsAt: string;
  cached: boolean;
  course: {
    id: string;
    title: string;
    description: string;
    coverImageUrl: string | null;
    averageRating: number | null;
  };
};

export type CourseRecommendationErrorCode =
  | "COURSE_COMPLETION_REQUIRED"
  | "NO_ELIGIBLE_COURSES"
  | "RECOMMENDATION_PENDING"
  | "RECOMMENDATION_RATE_LIMITED"
  | "RECOMMENDATION_UNAVAILABLE";

export class CourseRecommendationError extends Error {
  constructor(
    public readonly code: CourseRecommendationErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CourseRecommendationError";
  }
}

const selectionSchema = z.object({
  courseId: z.string().min(1),
});

const recommendationCourseSelect = {
  id: true,
  title: true,
  description: true,
  coverImageUrl: true,
  coverStoredFileId: true,
  ratings: { select: { rating: true } },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_TIMEOUT_MS = 2 * 60 * 1000;

function utcPeriod(now: Date) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const resetsAt = new Date(periodStart.getTime() + DAY_MS);
  return { periodStart, resetsAt };
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function averageRating(ratings: Array<{ rating: number }>) {
  if (ratings.length === 0) return null;
  const average = ratings.reduce((total, rating) => total + rating.rating, 0) / ratings.length;
  return Math.round(average * 10) / 10;
}

function responseFor(
  kind: CourseRecommendationKind,
  generatedAt: Date,
  resetsAt: Date,
  cached: boolean,
  course: {
    id: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    coverStoredFileId: string | null;
    ratings: Array<{ rating: number }>;
  },
): DailyCourseRecommendation {
  return {
    kind,
    generatedAt: generatedAt.toISOString(),
    resetsAt: resetsAt.toISOString(),
    cached,
    course: {
      id: course.id,
      title: course.title,
      description: plainTextExcerpt(course.description),
      coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null,
      averageRating: averageRating(course.ratings),
    },
  };
}

async function loadEligibleCourse(userId: string, courseId: string) {
  return prisma.course.findFirst({
    where: {
      id: courseId,
      isPublic: true,
      published: true,
      createdById: { not: userId },
      enrollments: { none: { userId } },
      modules: { some: { lessons: { some: {} } } },
    },
    select: recommendationCourseSelect,
  });
}

function completedCourseContext(course: {
  title: string;
  description: string | null;
  tags: Array<{ tag: { name: string } }>;
  modules: Array<{ title: string; lessons: Array<{ title: string }> }>;
}) {
  return {
    title: course.title,
    description: plainTextExcerpt(course.description).slice(0, 500),
    tags: course.tags.map(({ tag }) => tag.name),
    modules: course.modules.map((courseModule) => ({
      title: courseModule.title,
      lessons: courseModule.lessons.map((lesson) => lesson.title),
    })),
  };
}

function candidateContext(course: {
  id: string;
  title: string;
  description: string | null;
  tags: Array<{ tag: { name: string } }>;
}) {
  return {
    id: course.id,
    title: course.title,
    description: plainTextExcerpt(course.description).slice(0, 500),
    tags: course.tags.map(({ tag }) => tag.name),
  };
}

export async function getDailyCourseRecommendation(
  userId: string,
  kind: CourseRecommendationKind,
  now = new Date(),
): Promise<DailyCourseRecommendation> {
  const { periodStart, resetsAt } = utcPeriod(now);
  let reservationId: string | null = null;

  try {
    const completedCourse = await prisma.courseEnrollment.findFirst({
      where: { userId, completedAt: { not: null } },
      select: { id: true },
    });
    if (!completedCourse) {
      throw new CourseRecommendationError(
        "COURSE_COMPLETION_REQUIRED",
        409,
        "Finish one course to unlock daily course picks.",
      );
    }

    const existing = await prisma.dailyCourseRecommendation.findUnique({
      where: { userId_kind_periodStart: { userId, kind, periodStart } },
      select: { id: true, courseId: true, createdAt: true },
    });

    if (existing?.courseId) {
      const course = await loadEligibleCourse(userId, existing.courseId);
      if (course) return responseFor(kind, existing.createdAt, resetsAt, true, course);
      await prisma.dailyCourseRecommendation.delete({ where: { id: existing.id } });
    } else if (existing) {
      if (now.getTime() - existing.createdAt.getTime() < PENDING_TIMEOUT_MS) {
        throw new CourseRecommendationError(
          "RECOMMENDATION_PENDING",
          409,
          "Your daily pick is still being prepared. Try again in a moment.",
        );
      }
      await prisma.dailyCourseRecommendation.delete({ where: { id: existing.id } });
    }

    const completedEnrollments = await prisma.courseEnrollment.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 12,
      select: {
        course: {
          select: {
            title: true,
            description: true,
            tags: { select: { tag: { select: { name: true } } } },
            modules: {
              orderBy: { order: "asc" },
              take: 12,
              select: {
                title: true,
                lessons: { orderBy: { order: "asc" }, take: 20, select: { title: true } },
              },
            },
          },
        },
      },
    });

    const candidates = await prisma.course.findMany({
      where: {
        isPublic: true,
        published: true,
        createdById: { not: userId },
        enrollments: { none: { userId } },
        modules: { some: { lessons: { some: {} } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        description: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    if (candidates.length === 0) {
      throw new CourseRecommendationError(
        "NO_ELIGIBLE_COURSES",
        404,
        "There are no new courses available for you right now.",
      );
    }

    const todaySelections = await prisma.dailyCourseRecommendation.findMany({
      where: { userId, periodStart, courseId: { not: null } },
      select: { courseId: true },
    });
    const todayIds = new Set(todaySelections.flatMap((item) => item.courseId ? [item.courseId] : []));
    const candidatesNotUsedToday = candidates.filter((candidate) => !todayIds.has(candidate.id));
    const distinctCandidates = candidatesNotUsedToday.length > 0 ? candidatesNotUsedToday : candidates;

    const recent = await prisma.dailyCourseRecommendation.findMany({
      where: { userId, kind, courseId: { not: null }, periodStart: { lt: periodStart } },
      orderBy: { periodStart: "desc" },
      take: 7,
      select: { courseId: true },
    });
    const recentIds = new Set(recent.flatMap((item) => item.courseId ? [item.courseId] : []));
    const unseenCandidates = distinctCandidates.filter((candidate) => !recentIds.has(candidate.id));
    const selectableCandidates = unseenCandidates.length > 0 ? unseenCandidates : distinctCandidates;

    try {
      const reservation = await prisma.dailyCourseRecommendation.create({
        data: { userId, kind, periodStart },
        select: { id: true },
      });
      reservationId = reservation.id;
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await prisma.dailyCourseRecommendation.findUnique({
        where: { userId_kind_periodStart: { userId, kind, periodStart } },
        select: { courseId: true, createdAt: true },
      });
      if (concurrent?.courseId) {
        const course = await loadEligibleCourse(userId, concurrent.courseId);
        if (course) return responseFor(kind, concurrent.createdAt, resetsAt, true, course);
      }
      throw new CourseRecommendationError(
        "RECOMMENDATION_PENDING",
        409,
        "Your daily pick is still being prepared. Try again in a moment.",
      );
    }

    const rateLimit = await consumeRateLimit(
      "daily-course-recommendation",
      `${userId}:${kind}`,
      { limit: 3, windowMs: DAY_MS },
      now,
    );
    if (!rateLimit.allowed) {
      throw new CourseRecommendationError(
        "RECOMMENDATION_RATE_LIMITED",
        429,
        "The recommendation service has had too many attempts. Try again later.",
      );
    }

    const completedContext = completedEnrollments.map(({ course }) => completedCourseContext(course));
    const availableContext = selectableCandidates.map(candidateContext);
    const strategy = kind === "HIVE_PICK"
      ? "Choose the strongest meaningful continuation of the learner's completed topics and skills."
      : "Choose the course with the least topical overlap, giving the learner a genuinely different subject to explore.";
    const promptContext = JSON.stringify({ completedCourses: completedContext, availableCourses: availableContext }).slice(0, 12_000);

    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: selectionSchema,
      maxOutputTokens: 80,
      system: "You select one educational course for a learner. Return only an exact course ID from the availableCourses list. Never invent an ID.",
      prompt: `${strategy}\n\n${promptContext}`,
    });

    const selected = selectableCandidates.find((candidate) => candidate.id === object.courseId);
    if (!selected) throw new Error("The recommendation model returned an unavailable course");

    await prisma.dailyCourseRecommendation.update({
      where: { id: reservationId },
      data: { courseId: selected.id },
    });
    const course = await loadEligibleCourse(userId, selected.id);
    if (!course) throw new Error("The selected course is no longer available");

    return responseFor(kind, now, resetsAt, false, course);
  } catch (error) {
    if (reservationId) {
      await prisma.dailyCourseRecommendation.deleteMany({
        where: { id: reservationId, courseId: null },
      }).catch(() => undefined);
    }
    if (error instanceof CourseRecommendationError) throw error;
    console.error("daily_course_recommendation_failed", { userId, kind, error });
    throw new CourseRecommendationError(
      "RECOMMENDATION_UNAVAILABLE",
      503,
      "Today's course pick could not be prepared. Try again later.",
    );
  }
}
