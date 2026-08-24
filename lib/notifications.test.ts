import { beforeEach, describe, expect, it, vi } from "vitest";
import { materializeDueReminderNotifications, notifyClassroomMembers } from "./notifications";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({ prisma: {
  classroom: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, classroomMember: { findMany: vi.fn() },
  userSettings: { findMany: vi.fn(), findUnique: vi.fn() }, notification: { createMany: vi.fn(), create: vi.fn() },
  reminder: { findMany: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn(),
} }));

describe("notification preferences", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("excludes classroom recipients who disabled classroom alerts", async () => {
    vi.mocked(prisma.classroom.findUnique).mockResolvedValue({ name: "Biology" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Teacher" } as never);
    vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([{ userId: "teacher" }, { userId: "student-a" }, { userId: "student-b" }] as never);
    vi.mocked(prisma.userSettings.findMany).mockResolvedValue([{ userId: "student-b" }] as never);
    await notifyClassroomMembers({ classroomId: "class-1", actorId: "teacher", title: "New test", body: "Chapter 2" });
    const call = vi.mocked(prisma.notification.createMany).mock.calls[0][0] as { data: Array<{ userId: string }> };
    expect(call.data.map((item) => item.userId)).toEqual(["student-a"]);
  });

  it("can target only students for edited classroom work", async () => {
    vi.mocked(prisma.classroom.findUnique).mockResolvedValue({ name: "Biology" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: "Teacher" } as never);
    vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([{ userId: "student-a" }] as never);
    vi.mocked(prisma.userSettings.findMany).mockResolvedValue([] as never);

    await notifyClassroomMembers({
      classroomId: "class-1", actorId: "teacher", title: "Assignment updated", body: "Essay changed",
      recipientRoles: ["STUDENT"],
    });

    expect(prisma.classroomMember.findMany).toHaveBeenCalledWith({
      where: { classroomId: "class-1", role: { in: ["STUDENT"] } },
      select: { userId: true },
    });
  });

  it("suppresses and marks due reminder alerts while the preference is off", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ reminderNotifications: false } as never);
    vi.mocked(prisma.reminder.findMany).mockResolvedValue([{ id: "reminder-1", task: "Read" }] as never);
    const result = await materializeDueReminderNotifications("user-1");
    expect(result).toEqual([]);
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { notificationProcessedAt: expect.any(Date) } }));
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
