import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { updateUserStreak } from "@/lib/streak";
import { recordMeaningfulActivity } from "./activity";

vi.mock("@/lib/db", () => ({
  prisma: {
    activityRecord: { create: vi.fn() },
    classroomMember: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/streak", () => ({ updateUserStreak: vi.fn() }));

describe("recordMeaningfulActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.activityRecord.create).mockResolvedValue({ id: "activity-1" } as never);
  });

  it("records non-classroom activity without resolving or storing a role", async () => {
    const result = await recordMeaningfulActivity({
      userId: "user-1",
      activityType: "COURSE_CREATED",
      courseId: "course-1",
      relatedId: "course-1",
      dedupeKey: "course-created-1",
    });

    expect(result.recorded).toBe(true);
    expect(prisma.classroomMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.activityRecord.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        activityType: "COURSE_CREATED",
        courseId: "course-1",
        classroomId: null,
        relatedId: "course-1",
        dedupeKey: "course-created-1",
      },
    });
  });

  it("allows student classroom activities from the current membership", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);

    const result = await recordMeaningfulActivity({
      userId: "student-1",
      classroomId: "classroom-1",
      activityType: "ASSIGNMENT_SUBMITTED",
      dedupeKey: "submission-1",
    });

    expect(result.recorded).toBe(true);
    expect(prisma.classroomMember.findUnique).toHaveBeenCalledWith({
      where: { userId_classroomId: { userId: "student-1", classroomId: "classroom-1" } },
      select: { role: true },
    });
  });

  it("rejects teacher-only activity for a student", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);

    await expect(recordMeaningfulActivity({
      userId: "student-1",
      classroomId: "classroom-1",
      activityType: "ASSIGNMENT_CREATED",
      dedupeKey: "assignment-1",
    })).resolves.toEqual({ recorded: false, reason: "not_meaningful_for_role" });
    expect(prisma.activityRecord.create).not.toHaveBeenCalled();
  });

  it.each(["TEACHER", "TEACHING_ASSISTANT"] as const)(
    "allows teacher activity for a %s membership",
    async (role) => {
      vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role } as never);

      const result = await recordMeaningfulActivity({
        userId: "staff-1",
        classroomId: "classroom-1",
        activityType: "ASSIGNMENT_CREATED",
        dedupeKey: `assignment-${role}`,
      });

      expect(result.recorded).toBe(true);
    },
  );

  it("rejects classroom activity for a non-member", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);

    await expect(recordMeaningfulActivity({
      userId: "outsider-1",
      classroomId: "classroom-1",
      activityType: "ASSIGNMENT_SUBMITTED",
      dedupeKey: "outsider-submission",
    })).resolves.toEqual({ recorded: false, reason: "not_meaningful_for_role" });
    expect(prisma.activityRecord.create).not.toHaveBeenCalled();
    expect(updateUserStreak).not.toHaveBeenCalled();
  });
});
