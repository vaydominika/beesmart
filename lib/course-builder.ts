import type { CourseVisibility } from "@/lib/course-summary";

export interface CourseBuilderFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  isVisible: boolean;
}

export interface CourseBuilderLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  content: string | null;
  contentDraft: string | null;
  order: number;
  isLocked: boolean;
  files?: CourseBuilderFile[];
}

export interface CourseBuilderModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: CourseBuilderLesson[];
}

export interface CourseBuilderCourse {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  createdById: string;
  classroomId: string | null;
  isPublic: boolean;
  visibility: CourseVisibility;
  published: boolean;
  modules: CourseBuilderModule[];
}

export type CourseBuilderUpdate = Partial<Pick<CourseBuilderCourse, "title" | "visibility" | "published">>;

export function lessonCount(course: Pick<CourseBuilderCourse, "modules">): number {
  return course.modules.reduce((total, module) => total + module.lessons.length, 0);
}

export function findLesson(course: Pick<CourseBuilderCourse, "modules">, lessonId: string | null): CourseBuilderLesson | undefined {
  if (!lessonId) return undefined;
  return course.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === lessonId);
}

export function updateLesson(course: CourseBuilderCourse, lesson: CourseBuilderLesson): CourseBuilderCourse {
  return {
    ...course,
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((current) => current.id === lesson.id ? { ...current, ...lesson } : current),
    })),
  };
}

export function reorderModules(modules: CourseBuilderModule[], sourceIndex: number, destinationIndex: number): CourseBuilderModule[] {
  if (
    sourceIndex === destinationIndex
    || sourceIndex < 0
    || destinationIndex < 0
    || sourceIndex >= modules.length
    || destinationIndex >= modules.length
  ) return modules;

  const reordered = [...modules];
  const [movedModule] = reordered.splice(sourceIndex, 1);
  if (!movedModule) return modules;
  reordered.splice(destinationIndex, 0, movedModule);
  return reordered.map((module, order) => ({ ...module, order }));
}
