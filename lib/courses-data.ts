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
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          modules: { include: { lessons: true } },
          ratings: true,
        },
      },
    },
  });

  const progressByCourse = await prisma.courseProgress.findMany({
    where: { userId },
    select: { lessonId: true, completedAt: true },
  });
  const completedLessonIds = new Set(
    progressByCourse.filter((p) => p.completedAt).map((p) => p.lessonId)
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

export async function getPopularCourses(): Promise<CourseCard[]> {
  const courses = await prisma.course.findMany({
    where: { isPublic: true },
    include: {
      ratings: true,
      enrollments: true,
    },
    take: 12,
  });

  const withAvg = courses.map((c) => {
    const avg =
      c.ratings.length > 0
        ? c.ratings.reduce((s, r) => s + r.rating, 0) / c.ratings.length
        : null;
    return { course: c, averageRating: avg, enrollCount: c.enrollments.length };
  });
  withAvg.sort((a, b) => {
    const ar = a.averageRating ?? 0;
    const br = b.averageRating ?? 0;
    if (br !== ar) return br - ar;
    return b.enrollCount - a.enrollCount;
  });

  return withAvg.slice(0, 12).map(({ course, averageRating }) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl,
    averageRating:
      averageRating !== null ? Math.round(averageRating * 10) / 10 : null,
  }));
}

export async function getDiscoverCoursesForUser(
  userId: string
): Promise<CourseCard[]> {
  const enrolled = await prisma.courseEnrollment
    .findMany({ where: { userId }, select: { courseId: true } })
    .then((r) => new Set(r.map((e) => e.courseId)));

  const courses = await prisma.course.findMany({
    where: { isPublic: true, id: { notIn: [...enrolled] } },
    include: { ratings: true },
  });

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

export async function getRemindersForUser(
  userId: string
): Promise<ReminderItem[]> {
  const list = await prisma.reminder.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      classroomMemberships: { take: 1, orderBy: { joinedAt: "asc" } },
    },
  });
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
    avatar: user.avatar,
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
    reminders,
    streak,
    user,
  ] = await Promise.all([
    uid ? getContinueLearningForUser(uid) : Promise.resolve([]),
    getPopularCourses(),
    uid ? getDiscoverCoursesForUser(uid) : Promise.resolve([]),
    uid ? getRemindersForUser(uid) : Promise.resolve([]),
    uid ? getStreakForUser(uid) : Promise.resolve(0),
    uid ? getCurrentUserById(uid) : Promise.resolve(null),
  ]);
  return {
    continueLearning,
    popularCourses,
    discoverCourses,
    reminders,
    streak,
    user,
  };
}
