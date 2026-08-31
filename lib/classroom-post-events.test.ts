import { describe, expect, it } from "vitest";
import { classroomAssignmentHref, classroomPostCreatesCalendarEvent, classroomPostDeleteDetails } from "./classroom-post-events";

describe("classroom post calendar events", () => {
    it("broadcasts calendar changes for newly published classroom work", () => {
        expect(classroomPostCreatesCalendarEvent("ASSIGNMENT")).toBe(true);
        expect(classroomPostCreatesCalendarEvent("TEST")).toBe(true);
        expect(classroomPostCreatesCalendarEvent("TEXT")).toBe(false);
        expect(classroomPostCreatesCalendarEvent("MATERIAL")).toBe(false);
    });

    it("opens an assignment from its classroom post", () => {
        expect(classroomAssignmentHref("class-1", "assignment-1"))
            .toBe("/classroom/class-1/assignments/assignment-1");
    });

    it("deletes structured classroom work through its owning endpoint", () => {
        expect(classroomPostDeleteDetails("class-1", {
            id: "post-1",
            assignment: { id: "assignment-1" },
        })).toEqual({
            endpoint: "/api/classrooms/class-1/assignments/assignment-1",
            kind: "assignment",
        });

        expect(classroomPostDeleteDetails("class-1", {
            id: "post-2",
            test: { id: "test-1", type: "TEST" },
        })).toEqual({
            endpoint: "/api/classrooms/class-1/tests/test-1",
            kind: "test",
        });

        expect(classroomPostDeleteDetails("class-1", {
            id: "post-3",
            test: { id: "exam-1", type: "EXAM" },
        })).toEqual({
            endpoint: "/api/classrooms/class-1/tests/exam-1",
            kind: "exam",
        });
    });

    it("keeps ordinary post deletion scoped to the post", () => {
        expect(classroomPostDeleteDetails("class-1", { id: "post-4" })).toEqual({
            endpoint: "/api/classrooms/class-1/posts/post-4",
            kind: "post",
        });
    });
});
