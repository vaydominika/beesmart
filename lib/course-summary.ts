export type CourseRelationship = "owner" | "learner";
export type CourseTab = "learning" | "created";
export type CourseVisibility = "PRIVATE" | "PUBLIC" | "INVITATION_ONLY";
export type LearningStatus = "all" | "not-started" | "in-progress" | "completed";
export type CreatedStatus = "all" | "draft" | "published";

export interface CourseClassroomSummary {
  id: string;
  name: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  createdById: string;
  classroomId: string | null;
  isPublic: boolean;
  published: boolean;
  visibility: CourseVisibility;
  createdAt: string;
  updatedAt: string;
  relationship: CourseRelationship;
  isEnrolled: boolean;
  progress: number;
  lastAccessedAt: string | null;
  lessonCount: number;
  classrooms: CourseClassroomSummary[];
  creator: {
    id: string;
    name: string | null;
    avatar?: string | null;
  };
  _count: {
    modules: number;
    enrollments: number;
  };
}

export function plainTextExcerpt(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function learningStatus(course: Pick<CourseSummary, "progress">): Exclude<LearningStatus, "all"> {
  if (course.progress >= 100) return "completed";
  if (course.progress > 0) return "in-progress";
  return "not-started";
}

export function courseMatchesSearch(course: CourseSummary, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    course.title,
    plainTextExcerpt(course.description),
    course.creator.name || "",
    ...course.classrooms.map((classroom) => classroom.name),
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

export function sortLearningCourses(courses: CourseSummary[]): CourseSummary[] {
  const rank: Record<Exclude<LearningStatus, "all">, number> = {
    "in-progress": 0,
    "not-started": 1,
    completed: 2,
  };
  return [...courses].sort((a, b) => {
    const statusDifference = rank[learningStatus(a)] - rank[learningStatus(b)];
    if (statusDifference !== 0) return statusDifference;
    const aDate = new Date(a.lastAccessedAt || a.updatedAt).getTime();
    const bDate = new Date(b.lastAccessedAt || b.updatedAt).getTime();
    return bDate - aDate;
  });
}

export function sortCreatedCourses(courses: CourseSummary[]): CourseSummary[] {
  return [...courses].sort((a, b) => {
    if (a.published !== b.published) return a.published ? 1 : -1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function initialCourseTab(stored: string | null, courses: CourseSummary[]): CourseTab {
  if (stored === "learning" || stored === "created") return stored;
  return courses.some((course) => course.relationship === "learner") ? "learning" : "created";
}

export function dedupeClassrooms(classrooms: CourseClassroomSummary[]): CourseClassroomSummary[] {
  return Array.from(new Map(classrooms.map((classroom) => [classroom.id, classroom])).values());
}
