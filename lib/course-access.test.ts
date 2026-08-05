import { describe, expect, it } from "vitest";
import { accessibleCourseWhere, classroomCourseAccessWhere } from "./course-access";

describe("course access rules", () => {
  it("allows published non-private courses from direct or linked classrooms", () => {
    const rule = classroomCourseAccessWhere("user-1");
    expect(rule).toEqual({
      published: true,
      visibility: { not: "PRIVATE" },
      OR: [
        { classroom: { is: { members: { some: { userId: "user-1" } } } } },
        { classroomLinks: { some: { classroom: { members: { some: { userId: "user-1" } } } } } },
      ],
    });
  });

  it("reuses classroom membership in the shared access rule", () => {
    expect(accessibleCourseWhere("user-1").OR).toContainEqual(classroomCourseAccessWhere("user-1"));
  });
});
