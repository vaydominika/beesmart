import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { TEST_IDENTITIES } from "@/test-utils/factories";

const fixtureUserIds = Object.values(TEST_IDENTITIES).map(({ id }) => id);

async function cleanFixtures() {
  await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
}

async function seedUsers() {
  await prisma.user.createMany({
    data: Object.values(TEST_IDENTITIES).map(({ id, email, name }) => ({ id, email, name })),
  });
}

describe("MariaDB integration", () => {
  beforeEach(async () => {
    await cleanFixtures();
    await seedUsers();
  });

  afterEach(cleanFixtures);

  it("enforces one classroom membership per user and cascades classroom data", async () => {
    await prisma.classroom.create({
      data: {
        id: "e2e-classroom",
        name: "Integration Classroom",
        code: "INTG2026",
        createdById: TEST_IDENTITIES.teacher.id,
        members: {
          create: [
            { userId: TEST_IDENTITIES.teacher.id, role: "TEACHER" },
            { userId: TEST_IDENTITIES.student.id, role: "STUDENT" },
          ],
        },
      },
    });

    await expect(prisma.classroomMember.create({
      data: { userId: TEST_IDENTITIES.student.id, classroomId: "e2e-classroom", role: "STUDENT" },
    })).rejects.toMatchObject({ code: "P2002" });

    await prisma.classroom.delete({ where: { id: "e2e-classroom" } });
    expect(await prisma.classroomMember.count({ where: { classroomId: "e2e-classroom" } })).toBe(0);
  });

  it("rolls back related writes when a transaction fails", async () => {
    await expect(prisma.$transaction(async (tx) => {
      await tx.course.create({
        data: { id: "integration-course", title: "Transactional Course", createdById: TEST_IDENTITIES.teacher.id },
      });
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");

    expect(await prisma.course.findUnique({ where: { id: "integration-course" } })).toBeNull();
  });

  it("enforces submission and focus-session idempotency under concurrent writes", async () => {
    await prisma.classroom.create({
      data: { id: "e2e-classroom", name: "Integration Classroom", code: "INTG2026", createdById: TEST_IDENTITIES.teacher.id },
    });
    await prisma.assignedWork.create({
      data: {
        id: "integration-assignment",
        title: "Concurrency",
        assignedById: TEST_IDENTITIES.teacher.id,
        assignedToId: TEST_IDENTITIES.student.id,
        classroomId: "e2e-classroom",
        deadlineAt: new Date("2030-01-01T10:00:00.000Z"),
        deadlineTimeZone: "Europe/Budapest",
      },
    });

    const submissions = await Promise.allSettled([
      prisma.submission.create({ data: { assignedWorkId: "integration-assignment", userId: TEST_IDENTITIES.student.id } }),
      prisma.submission.create({ data: { assignedWorkId: "integration-assignment", userId: TEST_IDENTITIES.student.id } }),
    ]);
    expect(submissions.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await prisma.submission.count({ where: { assignedWorkId: "integration-assignment" } })).toBe(1);

    const focusSessions = await Promise.allSettled([
      prisma.focusSession.create({ data: { userId: TEST_IDENTITIES.student.id, completionId: "same-completion", durationSeconds: 60, type: "ACTIVE", startedAt: new Date("2026-02-16T09:59:00Z"), endedAt: new Date("2026-02-16T10:00:00Z") } }),
      prisma.focusSession.create({ data: { userId: TEST_IDENTITIES.student.id, completionId: "same-completion", durationSeconds: 60, type: "ACTIVE", startedAt: new Date("2026-02-16T09:59:00Z"), endedAt: new Date("2026-02-16T10:00:00Z") } }),
    ]);
    expect(focusSessions.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  });
});
