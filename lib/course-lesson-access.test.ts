import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getLessonAccess } from "./course-access";

vi.mock("@/lib/db", () => ({
    prisma: {
        course: { findFirst: vi.fn() },
        courseLesson: { findFirst: vi.fn() },
        courseModule: { findMany: vi.fn() },
        courseProgress: { findMany: vi.fn() },
    },
}));

describe("lesson progression access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.course.findFirst).mockResolvedValue({ id: "course-1" } as never);
        vi.mocked(prisma.courseLesson.findFirst).mockResolvedValue({
            id: "lesson-2", moduleId: "module-1", module: { course: { createdById: "teacher-1" } },
        } as never);
        vi.mocked(prisma.courseModule.findMany).mockResolvedValue([
            { lessons: [{ id: "lesson-1", isLocked: true }, { id: "lesson-2", isLocked: false }] },
        ] as never);
        vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([]);
    });

    it("blocks later content when an earlier prerequisite is incomplete", async () => {
        await expect(getLessonAccess({ courseId: "course-1", moduleId: "module-1", lessonId: "lesson-2", userId: "student-1" }))
            .resolves.toEqual({ allowed: false, reason: "LESSON_LOCKED", blockingLessonIds: ["lesson-1"] });
    });

    it("allows the learner after the prerequisite is completed", async () => {
        vi.mocked(prisma.courseProgress.findMany).mockResolvedValue([{ lessonId: "lesson-1" }] as never);
        await expect(getLessonAccess({ courseId: "course-1", moduleId: "module-1", lessonId: "lesson-2", userId: "student-1" }))
            .resolves.toEqual({ allowed: true, lessonId: "lesson-2", isCreator: false });
    });

    it("lets the course creator bypass progression", async () => {
        await expect(getLessonAccess({ courseId: "course-1", moduleId: "module-1", lessonId: "lesson-2", userId: "teacher-1" }))
            .resolves.toEqual({ allowed: true, lessonId: "lesson-2", isCreator: true });
        expect(prisma.courseModule.findMany).not.toHaveBeenCalled();
    });
});
