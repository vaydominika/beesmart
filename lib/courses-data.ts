import { prisma, getCurrentUserId } from "@/lib/db";
import type {
  CourseCard,
  CurrentUser,
  DashboardData,
} from "@/lib/types";
import { storedFileUrl } from "@/lib/files/types";
import { getActiveTicketCount } from "@/lib/tickets";

export async function getContinueLearningForUser(
  userId: string
): Promise<CourseCard[]> {
  type EnrollmentWithCourse = {
    course: {
      id: string;
      title: string;
      description: string | null;
      coverImageUrl: string | null;
      coverStoredFileId: string | null;
      modules: { lessons: { id: string }[] }[];
      ratings: { rating: number }[];
    };
  };
  const enrollments = (await prisma.courseEnrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          modules: { include: { lessons: true } },
          ratings: true,
        },
      },
    },
  })) as EnrollmentWithCourse[];

  const progressByCourse = (await prisma.courseProgress.findMany({
    where: { userId },
    select: { lessonId: true, completedAt: true },
  })) as { lessonId: string; completedAt: Date | null }[];
  const completedLessonIds = new Set(
    progressByCourse
      .filter((p) => p.completedAt != null)
      .map((p) => p.lessonId)
  );

  return enrollments.map((e) => {
    const course = e.course;
    const totalLessons = course.modules.reduce(
      (acc, m) => acc + m.lessons.length,
      0
    );
    const completed = course.modules.reduce(
      (acc, m) =>
        acc + m.lessons.filter((l) => completedLessonIds.has(l.id)).length,
      0
    );
    const progress =
      totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
    const avg =
      course.ratings.length > 0
        ? course.ratings.reduce((s, r) => s + r.rating, 0) / course.ratings.length
        : null;
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null,
      progress,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    };
  });
}

/**
 * Shared helper to calculate progress for a list of courses for a user
 */
async function getProgressForCourses(userId: string, courseIds: string[]): Promise<Map<string, number>> {
  const progressMap = new Map<string, number>();
  type ProgressCourse = { id: string; modules: Array<{ lessons: Array<{ id: string }> }> };
  type LessonProgress = { lessonId: string; completedAt: Date | null };

  // Fetch all relevant lessons for these courses to calculate total
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: { modules: { include: { lessons: { select: { id: true } } } } }
  }) as ProgressCourse[];

  const userProgress = await prisma.courseProgress.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { lessonId: true, completedAt: true, courseId: true }
  }) as LessonProgress[];

  const completedLessonIds = new Set(
    userProgress
      .filter((progress) => progress.completedAt != null)
      .map((progress) => progress.lessonId)
  );

  for (const course of courses) {
    const totalLessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
    if (totalLessons === 0) {
      progressMap.set(course.id, 0);
      continue;
    }

    const completed = course.modules.reduce(
      (total, module) => total + module.lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
      0
    );
    progressMap.set(course.id, Math.round((completed / totalLessons) * 100));
  }

  return progressMap;
}

type CourseWithRatings = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  coverStoredFileId: string | null;
  ratings: { rating: number }[];
  enrollments: unknown[];
};

export async function getPopularCourses(): Promise<CourseCard[]> {
  const userId = await getCurrentUserId();
  const enrolledData = userId ? (await prisma.courseEnrollment.findMany({
    where: { userId },
    select: { courseId: true },
  })) : [];
  const enrolledIds = new Set(enrolledData.map((enrollment: { courseId: string }) => enrollment.courseId));

  const courses = (await prisma.course.findMany({
    where: {
      isPublic: true,
      published: true,
      id: { notIn: Array.from(enrolledIds) },
      createdById: userId ? { not: userId } : undefined,
    },
    include: {
      ratings: true,
      enrollments: true,
    },
    take: 12,
  })) as CourseWithRatings[];

  const withAvg = courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
        : null;
    return { course: c, averageRating: avg, enrollCount: c.enrollments.length, isEnrolled: enrolledIds.has(c.id) };
  });

  const enrolledCourseIds = Array.from(enrolledIds) as string[];
  const progressMap = userId ? await getProgressForCourses(userId, enrolledCourseIds) : new Map<string, number>();

  withAvg.sort((a, b) => {
    const ar = a.averageRating ?? 0;
    const br = b.averageRating ?? 0;
    if (br !== ar) return br - ar;
    return b.enrollCount - a.enrollCount;
  });

  return withAvg.slice(0, 12).map(({ course, averageRating, isEnrolled }) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null,
    isEnrolled,
    progress: progressMap.get(course.id),
    averageRating:
      averageRating !== null ? Math.round(averageRating * 10) / 10 : null,
  }));
}

export async function getDiscoverCoursesForUser(
  userId: string
): Promise<CourseCard[]> {
  const enrolledData = (await prisma.courseEnrollment.findMany({
    where: { userId },
    select: { courseId: true },
  })) as { courseId: string }[];
  const enrolled = new Set(enrolledData.map((e) => e.courseId));

  const courses = (await prisma.course.findMany({
    where: {
      isPublic: true,
      published: true,
      id: { notIn: [...enrolled] },
      createdById: { not: userId }
    },
    include: { ratings: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  })) as { id: string; title: string; description: string | null; coverImageUrl: string | null; coverStoredFileId: string | null; ratings: { rating: number }[] }[];

  return courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
        : null;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverImageUrl: storedFileUrl(c.coverStoredFileId, c.coverImageUrl) || null,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    };
  });
}

export async function getMyCoursesForUser(userId: string): Promise<CourseCard[]> {
  const courses = (await prisma.course.findMany({
    where: { createdById: userId },
    include: { ratings: true },
    orderBy: { updatedAt: "desc" },
  })) as { id: string; title: string; description: string | null; coverImageUrl: string | null; coverStoredFileId: string | null; ratings: { rating: number }[] }[];

  return courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((sum, rating) => sum + rating.rating, 0) / c.ratings.length
        : null;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverImageUrl: storedFileUrl(c.coverStoredFileId, c.coverImageUrl) || null,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    };
  });
}

export async function getStreakForUser(userId: string): Promise<number> {
  const row = await prisma.streak.findUnique({
    where: { userId },
    select: { currentStreak: true },
  });
  return row?.currentStreak ?? 0;
}

export async function getCurrentUserById(
  userId: string
): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatar: true,
      bannerImageUrl: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    bannerImageUrl: user.bannerImageUrl,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const uid = await getCurrentUserId();
  const [
    continueLearning,
    popularCourses,
    discoverCourses,
    myCourses,
    streak,
    user,
    activeTicketCount,
  ] = await Promise.all([
    uid ? getContinueLearningForUser(uid) : Promise.resolve([]),
    getPopularCourses(),
    uid ? getDiscoverCoursesForUser(uid) : Promise.resolve([]),
    uid ? getMyCoursesForUser(uid) : Promise.resolve([]),
    uid ? getStreakForUser(uid) : Promise.resolve(0),
    uid ? getCurrentUserById(uid) : Promise.resolve(null),
    uid ? getActiveTicketCount(uid) : Promise.resolve(0),
  ]);

  // CATEGORIZATION LOGIC: Refined to use persisted completion and avoid duplicates
  const finishedCourses: CourseCard[] = [];
  const processedIds = new Set<string>();

  const filterFinished = (list: CourseCard[]) => {
    return list.filter(course => {
      // If already processed (e.g. in My Courses and Continue Learning), skip
      if (processedIds.has(course.id)) return false;

      // A course is finished if it has 100% progress
      if (course.progress === 100) {
        finishedCourses.push(course);
        processedIds.add(course.id);
        return false;
      }

      processedIds.add(course.id);
      return true;
    });
  };

  const filteredContinue = filterFinished(continueLearning);
  const filteredMy = filterFinished(myCourses);

  return {
    continueLearning: filteredContinue,
    popularCourses,
    discoverCourses,
    myCourses: filteredMy,
    finishedCourses,
    streak,
    activeTicketCount,
    user,
  };
}
