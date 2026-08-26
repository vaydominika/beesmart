import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { TEST_IDENTITIES, TEST_PASSWORD } from "@/test-utils/factories";

export const E2E_IDS = {
  classroom: "e2e-classroom",
  course: "e2e-course",
  module: "e2e-module",
  lesson: "e2e-lesson",
  assignment: "e2e-assignment",
  test: "e2e-test",
  question: "e2e-question",
  correctOption: "e2e-option-correct",
  incorrectOption: "e2e-option-incorrect",
} as const;

function assertSafeTestDatabase() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  let databaseName = "";
  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
  } catch {
    // The useful error is emitted below.
  }
  if (!databaseName.includes("test") && process.env.ALLOW_TEST_SEED !== "true") {
    throw new Error("Refusing to seed: use a database whose name contains 'test', or set ALLOW_TEST_SEED=true explicitly.");
  }
  process.env.DATABASE_URL = databaseUrl;
}

export async function seedTestData() {
  assertSafeTestDatabase();
  const password = await bcrypt.hash(TEST_PASSWORD, 10);
  const identities = Object.values(TEST_IDENTITIES);

  await prisma.user.deleteMany({ where: { id: { in: identities.map(({ id }) => id) } } });
  await prisma.user.createMany({
    data: identities.map(({ id, email, name }) => ({ id, email, name, password })),
  });

  await prisma.classroom.create({
    data: {
      id: E2E_IDS.classroom,
      name: "BeeSmart Testing Lab",
      description: "A deterministic classroom used by the browser test suite.",
      code: "BEE2026",
      subject: "Quality Engineering",
      createdById: TEST_IDENTITIES.teacher.id,
      members: {
        create: [
          { userId: TEST_IDENTITIES.teacher.id, role: "TEACHER" },
          { userId: TEST_IDENTITIES.student.id, role: "STUDENT" },
        ],
      },
    },
  });

  await prisma.course.create({
    data: {
      id: E2E_IDS.course,
      title: "Reliable Learning Systems",
      description: "A published course fixture for end-to-end testing.",
      createdById: TEST_IDENTITIES.teacher.id,
      isPublic: true,
      visibility: "PUBLIC",
      published: true,
      modules: {
        create: {
          id: E2E_IDS.module,
          title: "Testing foundations",
          order: 0,
          lessons: {
            create: {
              id: E2E_IDS.lesson,
              title: "Build confidence with tests",
              content: "<p>Reliable tests make change safer.</p>",
              contentDraft: "<p>Reliable tests make change safer.</p>",
              order: 0,
            },
          },
        },
      },
      classroomLinks: {
        create: { classroomId: E2E_IDS.classroom, addedById: TEST_IDENTITIES.teacher.id },
      },
      enrollments: {
        create: { userId: TEST_IDENTITIES.student.id },
      },
    },
  });

  await prisma.assignedWork.create({
    data: {
      id: E2E_IDS.assignment,
      title: "Testing reflection",
      description: "Explain one testing tradeoff.",
      assignedById: TEST_IDENTITIES.teacher.id,
      classroomId: E2E_IDS.classroom,
      deadlineAt: new Date("2030-02-20T17:00:00.000Z"),
      deadlineTimeZone: "Europe/Budapest",
      deadlineHasTime: true,
      maxPoints: 10,
    },
  });

  await prisma.test.create({
    data: {
      id: E2E_IDS.test,
      title: "Testing fundamentals",
      description: "A deterministic classroom test.",
      type: "TEST",
      classroomId: E2E_IDS.classroom,
      createdById: TEST_IDENTITIES.teacher.id,
      passingScore: 70,
      maxAttempts: 2,
      questions: {
        create: {
          id: E2E_IDS.question,
          questionText: "Which test checks a complete user journey?",
          questionType: "MULTIPLE_CHOICE",
          points: 1,
          options: {
            create: [
              { id: E2E_IDS.correctOption, optionText: "End-to-end test", isCorrect: true, order: 0 },
              { id: E2E_IDS.incorrectOption, optionText: "Type check", isCorrect: false, order: 1 },
            ],
          },
        },
      },
    },
  });

  await prisma.event.create({
    data: {
      id: "e2e-event",
      title: "Testing workshop",
      startDate: new Date("2030-02-18T00:00:00.000Z"),
      endDate: new Date("2030-02-18T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "11:00",
      userId: TEST_IDENTITIES.student.id,
      color: "yellow",
    },
  });

  await prisma.notification.create({
    data: {
      id: "e2e-notification",
      userId: TEST_IDENTITIES.student.id,
      title: "Welcome to the testing lab",
      body: "Your deterministic fixture is ready.",
      type: "OTHER",
      category: "GENERAL",
      actionUrl: `/classroom/${E2E_IDS.classroom}`,
    },
  });

  await prisma.userSettings.createMany({
    data: identities.map(({ id }) => ({ userId: id, theme: "bee" })),
  });
}

const isDirectExecution = process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/seed-test-data.ts");
if (isDirectExecution) {
  seedTestData()
    .then(() => console.info("Deterministic test data seeded."))
    .finally(() => prisma.$disconnect());
}
