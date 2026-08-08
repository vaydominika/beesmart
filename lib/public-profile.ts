import { accessibleCourseWhere } from "@/lib/course-access";
import { prisma } from "@/lib/db";

const ACTIVITY_COPY: Record<string, string> = {
  COURSE_STARTED: "Started",
  COURSE_CONTINUED: "Continued",
  COURSE_COMPLETED: "Completed",
  COURSE_CREATED: "Created",
  COURSE_UPDATED: "Updated",
  COURSE_PUBLISHED: "Published",
  LESSON_COMPLETED: "Completed a lesson in",
  ASSIGNMENT_SUBMITTED: "Submitted an assignment",
  TEST_COMPLETED: "Completed a test",
  CLASSROOM_COURSE_COMPLETED: "Completed a classroom course",
  CLASSROOM_TASK_COMPLETED: "Completed a classroom task",
  CLASSROOM_POST_PUBLISHED: "Published a classroom post",
  MATERIAL_UPLOADED: "Uploaded classroom material",
  ASSIGNMENT_CREATED: "Created an assignment",
  TEST_CREATED: "Created a test",
  TEST_SCHEDULED: "Scheduled a test",
  CLASSROOM_COURSE_PUBLISHED: "Published a classroom course",
  GRADE_PROVIDED: "Provided feedback",
};

export async function getPublicProfile(targetUserId: string, viewerUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      avatar: true,
      image: true,
      bannerImageUrl: true,
      createdAt: true,
      settings: { select: { profileVisibility: true, activitySharing: true } },
    },
  });
  if (!user) return { status: "not_found" as const };

  const isOwner = targetUserId === viewerUserId;
  const isPrivate = (user.settings?.profileVisibility ?? "PRIVATE") === "PRIVATE";
  if (isPrivate && !isOwner) {
    return { status: "private" as const, user: { id: user.id, name: user.name } };
  }

  const courses = await prisma.course.findMany({
    where: { createdById: targetUserId, published: true, visibility: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, description: true, coverImageUrl: true, updatedAt: true },
  });

  let activity: Array<{ id: string; text: string; createdAt: string; actionUrl: string | null }> = [];
  if (user.settings?.activitySharing !== false) {
    const records = await prisma.activityRecord.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, activityType: true, courseId: true, classroomId: true, createdAt: true },
    });
    const courseIds = [...new Set(records.flatMap((record: { courseId: string | null }) => record.courseId ? [record.courseId] : []))];
    const classroomIds = [...new Set(records.flatMap((record: { classroomId: string | null }) => record.classroomId ? [record.classroomId] : []))];
    const [accessibleCourses, sharedMemberships] = await Promise.all([
      courseIds.length ? prisma.course.findMany({
        where: { id: { in: courseIds }, ...accessibleCourseWhere(viewerUserId) },
        select: { id: true, title: true },
      }) : Promise.resolve([]),
      classroomIds.length ? prisma.classroomMember.findMany({
        where: { userId: viewerUserId, classroomId: { in: classroomIds } },
        select: { classroomId: true, classroom: { select: { name: true } } },
      }) : Promise.resolve([]),
    ]);
    const courseMap = new Map<string, string>(accessibleCourses.map((course: { id: string; title: string }) => [course.id, course.title]));
    const classroomMap = new Map<string, string>(sharedMemberships.map((membership: { classroomId: string; classroom: { name: string } }) => [membership.classroomId, membership.classroom.name]));
    activity = records.flatMap((record: { id: string; activityType: string; courseId: string | null; classroomId: string | null; createdAt: Date }) => {
      if (record.courseId && !courseMap.has(record.courseId)) return [];
      if (record.classroomId && !classroomMap.has(record.classroomId)) return [];
      const verb = ACTIVITY_COPY[record.activityType];
      if (!verb) return [];
      const resource = record.courseId ? courseMap.get(record.courseId) : record.classroomId ? classroomMap.get(record.classroomId) : null;
      return [{
        id: record.id,
        text: resource ? `${verb} ${resource}` : verb,
        createdAt: record.createdAt.toISOString(),
        actionUrl: record.courseId ? `/courses/${record.courseId}` : null,
      }];
    }).slice(0, 20);
  }

  return {
    status: "ok" as const,
    profile: {
      id: user.id,
      name: user.name,
      avatar: user.avatar ?? user.image ?? null,
      bannerImageUrl: user.bannerImageUrl,
      joinedAt: user.createdAt.toISOString(),
      isOwner,
      isPrivate,
      activitySharing: user.settings?.activitySharing !== false,
      courses: courses.map((course: { id: string; title: string; description: string | null; coverImageUrl: string | null; updatedAt: Date }) => ({ ...course, updatedAt: course.updatedAt.toISOString() })),
      activity,
    },
  };
}
