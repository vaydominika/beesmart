import { describe, expect, it } from "vitest";
import {
  CourseSummary,
  courseMatchesSearch,
  dedupeClassrooms,
  initialCourseTab,
  plainTextExcerpt,
  sortCreatedCourses,
  sortLearningCourses,
} from "./course-summary";

function course(overrides: Partial<CourseSummary> = {}): CourseSummary {
  return {
    id: "course-1",
    title: "Biology",
    description: "Cells and systems",
    coverImageUrl: null,
    createdById: "teacher-1",
    classroomId: null,
    isPublic: true,
    published: true,
    visibility: "PUBLIC",
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
    relationship: "learner",
    isEnrolled: true,
    progress: 0,
    lastAccessedAt: null,
    lessonCount: 4,
    classrooms: [],
    creator: { id: "teacher-1", name: "Ada" },
    _count: { modules: 2, enrollments: 3 },
    ...overrides,
  };
}

describe("course summary helpers", () => {
  it("converts rich descriptions to safe readable text", () => {
    expect(plainTextExcerpt("<p>Hello <strong>class</strong> &amp; friends</p><script>alert(1)</script>"))
      .toBe("Hello class & friends");
  });

  it("selects Learning first only when learner courses exist and no preference is stored", () => {
    expect(initialCourseTab(null, [course()])).toBe("learning");
    expect(initialCourseTab(null, [course({ relationship: "owner" })])).toBe("created");
    expect(initialCourseTab("created", [course()])).toBe("created");
  });

  it("sorts learning by state and then recent activity", () => {
    const completed = course({ id: "completed", progress: 100 });
    const untouched = course({ id: "untouched", progress: 0 });
    const olderActive = course({ id: "older-active", progress: 20, lastAccessedAt: "2026-08-02T08:00:00.000Z" });
    const newerActive = course({ id: "newer-active", progress: 50, lastAccessedAt: "2026-08-04T08:00:00.000Z" });
    expect(sortLearningCourses([completed, untouched, olderActive, newerActive]).map(({ id }) => id))
      .toEqual(["newer-active", "older-active", "untouched", "completed"]);
  });

  it("sorts created courses with recent drafts first", () => {
    const oldDraft = course({ id: "old-draft", relationship: "owner", published: false });
    const newDraft = course({ id: "new-draft", relationship: "owner", published: false, updatedAt: "2026-08-05T08:00:00.000Z" });
    const published = course({ id: "published", relationship: "owner", published: true, updatedAt: "2026-08-06T08:00:00.000Z" });
    expect(sortCreatedCourses([published, oldDraft, newDraft]).map(({ id }) => id))
      .toEqual(["new-draft", "old-draft", "published"]);
  });

  it("searches classroom names and deduplicates direct and linked origins", () => {
    const classrooms = dedupeClassrooms([{ id: "a", name: "Matematika" }, { id: "a", name: "Matematika" }]);
    expect(classrooms).toHaveLength(1);
    expect(courseMatchesSearch(course({ classrooms }), "matematika")).toBe(true);
  });
});
