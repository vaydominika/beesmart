import { prisma, getCurrentUserId } from "@/lib/db";
import type {
  CourseCard,
  ReminderItem,
  CurrentUser,
  DashboardData,
} from "@/lib/types";

export async function getContinueLearningForUser(
  userId: string
): Promise<CourseCard[]> {
  type EnrollmentWithCourse = {
    course: {
      id: string;
      title: string;
      description: string | null;
      coverImageUrl: string | null;
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
      coverImageUrl: course.coverImageUrl,
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

  // Fetch all relevant lessons for these courses to calculate total
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: { modules: { include: { lessons: { select: { id: true } } } } }
  });

  const userProgress = await prisma.courseProgress.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { lessonId: true, completedAt: true, courseId: true }
  });

  const completedLessonIds = new Set(
    userProgress
      .filter((p: any) => p.completedAt != null)
      .map((p: any) => p.lessonId)
  );

  for (const course of courses) {
    const totalLessons = course.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);
    if (totalLessons === 0) {
      progressMap.set(course.id, 0);
      continue;
    }

    const completed = course.modules.reduce(
      (acc: number, m: any) => acc + m.lessons.filter((l: any) => completedLessonIds.has(l.id)).length,
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
  ratings: { rating: number }[];
  enrollments: unknown[];
};

export async function getPopularCourses(): Promise<CourseCard[]> {
  const userId = await getCurrentUserId();
  const enrolledData = userId ? (await prisma.courseEnrollment.findMany({
    where: { userId },
    select: { courseId: true },
  })) : [];
  const enrolledIds = new Set(enrolledData.map((e: any) => e.courseId));

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
    coverImageUrl: course.coverImageUrl,
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
  })) as { id: string; title: string; description: string | null; coverImageUrl: string | null; ratings: { rating: number }[] }[];

  return courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
        : null;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverImageUrl: c.coverImageUrl,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    };
  });
}

export async function getMyCoursesForUser(userId: string): Promise<CourseCard[]> {
  const courses = (await prisma.course.findMany({
    where: { createdById: userId },
    include: { ratings: true },
    orderBy: { updatedAt: "desc" },
  })) as { id: string; title: string; description: string | null; coverImageUrl: string | null; ratings: { rating: number }[] }[];

  const courseIds = courses.map(c => c.id);
  const progressMap = await getProgressForCourses(userId, courseIds);

  return courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((s: number, r: any) => s + r.rating, 0) / c.ratings.length
        : null;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      coverImageUrl: c.coverImageUrl,
      progress: progressMap.get(c.id),
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    };
  });
}

export async function getRemindersForUser(
  userId: string
): Promise<ReminderItem[]> {
  const list = (await prisma.reminder.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  })) as { id: string; task: string; date: Date; time: string | null }[];
  return list.map((r) => ({
    id: r.id,
    task: r.task,
    date: r.date.toISOString().slice(0, 10),
    time: r.time,
  }));
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
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    include: {
      classroomMemberships: { take: 1, orderBy: { joinedAt: "asc" } },
    },
  })) as { id: string; name: string; avatar: string | null; image: string | null; bannerImageUrl: string | null; classroomMemberships: { role: string }[] } | null;
  if (!user) return null;
  const role = user.classroomMemberships[0]?.role ?? "STUDENT";
  const roleDisplay =
    role === "TEACHER"
      ? "Teacher"
      : role === "TEACHING_ASSISTANT"
        ? "Teaching Assistant"
        : "Learner";
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? user.image ?? null,
    bannerImageUrl: user.bannerImageUrl,
    role: roleDisplay,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const uid = await getCurrentUserId();
  const [
    continueLearning,
    popularCourses,
    discoverCourses,
    myCourses,
    reminders,
    streak,
    user,
  ] = await Promise.all([
    uid ? getContinueLearningForUser(uid) : Promise.resolve([]),
    getPopularCourses(),
    uid ? getDiscoverCoursesForUser(uid) : Promise.resolve([]),
    uid ? getMyCoursesForUser(uid) : Promise.resolve([]),
    uid ? getRemindersForUser(uid) : Promise.resolve([]),
    uid ? getStreakForUser(uid) : Promise.resolve(0),
    uid ? getCurrentUserById(uid) : Promise.resolve(null),
  ]);
  return {
    continueLearning,
    popularCourses,
    discoverCourses,
    myCourses,
    reminders,
    streak,
    user,
  };
}
