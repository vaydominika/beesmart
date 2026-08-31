import { describe, expect, it } from "vitest";
import { findLesson, lessonCount, reorderModules, updateLesson, type CourseBuilderCourse } from "./course-builder";

const course: CourseBuilderCourse = {
  id: "course-1",
  title: "Biology",
  description: null,
  coverImageUrl: null,
  createdById: "teacher-1",
  isPublic: false,
  visibility: "PRIVATE",
  published: false,
  modules: [{
    id: "module-1",
    courseId: "course-1",
    title: "Cells",
    description: null,
    order: 0,
    lessons: [{
      id: "lesson-1",
      moduleId: "module-1",
      title: "Cell structure",
      description: null,
      content: "Original",
      contentDraft: null,
      order: 0,
      isLocked: false,
    }],
  }],
};

describe("course builder helpers", () => {
  it("counts and finds lessons", () => {
    expect(lessonCount(course)).toBe(1);
    expect(findLesson(course, "lesson-1")?.title).toBe("Cell structure");
    expect(findLesson(course, null)).toBeUndefined();
  });

  it("updates a lesson without changing the surrounding course structure", () => {
    const updated = updateLesson(course, { ...course.modules[0].lessons[0], title: "Updated lesson" });
    expect(updated.modules[0].lessons[0].title).toBe("Updated lesson");
    expect(course.modules[0].lessons[0].title).toBe("Cell structure");
  });

  it("reorders modules and normalizes their order values", () => {
    const modules = [
      course.modules[0],
      { ...course.modules[0], id: "module-2", title: "Genetics", order: 1, lessons: [] },
      { ...course.modules[0], id: "module-3", title: "Ecology", order: 2, lessons: [] },
    ];

    const reordered = reorderModules(modules, 2, 0);

    expect(reordered.map((module) => module.id)).toEqual(["module-3", "module-1", "module-2"]);
    expect(reordered.map((module) => module.order)).toEqual([0, 1, 2]);
    expect(modules.map((module) => module.id)).toEqual(["module-1", "module-2", "module-3"]);
  });
});
