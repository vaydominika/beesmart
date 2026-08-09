import { accessibleCourseWhere } from "@/lib/course-access";
import { prisma } from "@/lib/db";
import { storedFileUrl } from "@/lib/files/types";

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
const DIRECT_POST_ACTIVITY_TYPES = new Set(["CLASSROOM_POST_PUBLISHED", "MATERIAL_UPLOADED"]);

type ProfileActivityRecord = {
  id: string;
  activityType: string;
  courseId: string | null;
  classroomId: string | null;
  relatedId: string | null;
  createdAt: Date;
};

function classroomPostKey(classroomId: string, relatedId: string) {
  return `${classroomId}:${relatedId}`;
}

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
    select: { id: true, title: true, description: true, coverImageUrl: true, coverStoredFileId: true, updatedAt: true },
  });

  let activity: Array<{ id: string; text: string; createdAt: string; actionUrl: string | null }> = [];
  if (user.settings?.activitySharing !== false) {
    const records = await prisma.activityRecord.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, activityType: true, courseId: true, classroomId: true, relatedId: true, createdAt: true },
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
    const relatedIds = [...new Set(records.flatMap((record: ProfileActivityRecord) => record.relatedId ? [record.relatedId] : []))];
    const sharedClassroomIds = [...classroomMap.keys()];
    const relatedPosts = sharedClassroomIds.length && relatedIds.length ? await prisma.classroomPost.findMany({
      where: {
        classroomId: { in: sharedClassroomIds },
        OR: [
          { id: { in: relatedIds } },
          { assignmentId: { in: relatedIds } },
          { testId: { in: relatedIds } },
          { courseId: { in: relatedIds } },
        ],
      },
      select: { id: true, classroomId: true, assignmentId: true, testId: true, courseId: true },
    }) : [];
    const directPostMap = new Map<string, string>();
    const assignmentPostMap = new Map<string, string>();
    const testPostMap = new Map<string, string>();
    const coursePostMap = new Map<string, string>();
    relatedPosts.forEach((post: { id: string; classroomId: string; assignmentId: string | null; testId: string | null; courseId: string | null }) => {
      directPostMap.set(classroomPostKey(post.classroomId, post.id), post.id);
      if (post.assignmentId) assignmentPostMap.set(classroomPostKey(post.classroomId, post.assignmentId), post.id);
      if (post.testId) testPostMap.set(classroomPostKey(post.classroomId, post.testId), post.id);
      if (post.courseId) coursePostMap.set(classroomPostKey(post.classroomId, post.courseId), post.id);
    });

    activity = records.flatMap((record: ProfileActivityRecord) => {
      if (record.courseId && !courseMap.has(record.courseId)) return [];
      if (record.classroomId && !classroomMap.has(record.classroomId)) return [];
      const verb = ACTIVITY_COPY[record.activityType];
      if (!verb) return [];
      if (record.classroomId && DIRECT_POST_ACTIVITY_TYPES.has(record.activityType) && !record.relatedId) return [];
      const resource = record.courseId ? courseMap.get(record.courseId) : record.classroomId ? classroomMap.get(record.classroomId) : null;
      let actionUrl = record.courseId ? `/courses/${record.courseId}` : record.classroomId ? `/classroom/${record.classroomId}` : null;
      if (record.classroomId && record.relatedId) {
        const key = classroomPostKey(record.classroomId, record.relatedId);
        if (DIRECT_POST_ACTIVITY_TYPES.has(record.activityType) && !directPostMap.has(key)) return [];
        const postId = record.activityType === "ASSIGNMENT_CREATED"
          ? assignmentPostMap.get(key)
          : record.activityType === "TEST_CREATED" || record.activityType === "TEST_SCHEDULED"
            ? testPostMap.get(key)
            : record.activityType === "CLASSROOM_COURSE_PUBLISHED"
              ? coursePostMap.get(key)
              : directPostMap.get(key);
        if (postId) actionUrl = `/classroom/${record.classroomId}?post=${postId}#classroom-post-${postId}`;
      }
      return [{
        id: record.id,
        text: resource ? `${verb} ${resource}` : verb,
        createdAt: record.createdAt.toISOString(),
        actionUrl,
      }];
    });
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
      courses: courses.map((course: { id: string; title: string; description: string | null; coverImageUrl: string | null; coverStoredFileId: string | null; updatedAt: Date }) => ({
        ...course, coverImageUrl: storedFileUrl(course.coverStoredFileId, course.coverImageUrl) || null, updatedAt: course.updatedAt.toISOString(),
      })),
      activity,
    },
  };
}
