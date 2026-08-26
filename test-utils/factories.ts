import type {
  ClassroomRole,
  CourseVisibility,
  FocusSessionType,
  NotificationCategory,
  NotificationType,
  QuestionType,
  SubmissionStatus,
  TestType,
} from "@/lib/generated/prisma";

const FIXED_NOW = new Date("2026-02-16T10:00:00.000Z");
let sequence = 0;

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export function resetFactorySequence() {
  sequence = 0;
}

export function buildUser(overrides: Partial<ReturnType<typeof baseUser>> = {}) {
  return { ...baseUser(), ...overrides };
}

function baseUser() {
  const id = nextId("user");
  return {
    id,
    email: `${id}@example.test`,
    name: `Test User ${id}`,
    password: null as string | null,
    emailVerified: null as Date | null,
    image: null as string | null,
    avatar: null as string | null,
    bannerImageUrl: null as string | null,
    avatarFileId: null as string | null,
    bannerFileId: null as string | null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildClassroom(overrides: Partial<ReturnType<typeof baseClassroom>> = {}) {
  return { ...baseClassroom(), ...overrides };
}

function baseClassroom() {
  const id = nextId("classroom");
  return {
    id,
    name: `Classroom ${id}`,
    description: "A deterministic classroom fixture",
    code: `BEE${String(sequence).padStart(5, "0")}`,
    subject: "Testing",
    createdById: "user-teacher",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildClassroomMember(overrides: Partial<ReturnType<typeof baseClassroomMember>> = {}) {
  return { ...baseClassroomMember(), ...overrides };
}

function baseClassroomMember() {
  return {
    id: nextId("member"),
    userId: "user-student",
    classroomId: "classroom-main",
    role: "STUDENT" as ClassroomRole,
    joinedAt: FIXED_NOW,
  };
}

export function buildCourse(overrides: Partial<ReturnType<typeof baseCourse>> = {}) {
  return { ...baseCourse(), ...overrides };
}

function baseCourse() {
  const id = nextId("course");
  return {
    id,
    title: `Course ${id}`,
    description: "A deterministic course fixture",
    coverImageUrl: null as string | null,
    coverStoredFileId: null as string | null,
    createdById: "user-teacher",
    classroomId: null as string | null,
    isPublic: false,
    visibility: "PRIVATE" as CourseVisibility,
    published: false,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildAssignment(overrides: Partial<ReturnType<typeof baseAssignment>> = {}) {
  return { ...baseAssignment(), ...overrides };
}

function baseAssignment() {
  const id = nextId("assignment");
  return {
    id,
    title: `Assignment ${id}`,
    description: "A deterministic assignment fixture",
    assignedById: "user-teacher",
    assignedToId: null as string | null,
    classroomId: "classroom-main",
    courseId: null as string | null,
    testId: null as string | null,
    deadlineAt: new Date("2026-02-20T17:00:00.000Z"),
    deadlineTimeZone: "Europe/Budapest",
    deadlineHasTime: true,
    isCompleted: false,
    completedAt: null as Date | null,
    isGraded: true,
    maxPoints: 100 as number | null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildTest(overrides: Partial<ReturnType<typeof baseTest>> = {}) {
  return { ...baseTest(), ...overrides };
}

function baseTest() {
  const id = nextId("test");
  return {
    id,
    courseId: null as string | null,
    lessonId: null as string | null,
    classroomId: "classroom-main" as string | null,
    title: `Test ${id}`,
    description: "A deterministic test fixture",
    type: "TEST" as TestType,
    timeLimit: 30 as number | null,
    passingScore: 70 as number | null,
    opensAt: null as Date | null,
    closesAt: null as Date | null,
    maxAttempts: 1,
    createdById: "user-teacher",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildQuestion(overrides: Partial<ReturnType<typeof baseQuestion>> = {}) {
  return { ...baseQuestion(), ...overrides };
}

function baseQuestion() {
  const id = nextId("question");
  return {
    id,
    testId: "test-main",
    questionText: `Question ${id}`,
    questionType: "MULTIPLE_CHOICE" as QuestionType,
    order: 0,
    points: 1,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildSubmission(overrides: Partial<ReturnType<typeof baseSubmission>> = {}) {
  return { ...baseSubmission(), ...overrides };
}

function baseSubmission() {
  return {
    id: nextId("submission"),
    assignedWorkId: "assignment-main",
    userId: "user-student",
    content: "Completed work",
    status: "SUBMITTED" as SubmissionStatus,
    submittedAt: FIXED_NOW as Date | null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildEvent(overrides: Partial<ReturnType<typeof baseEvent>> = {}) {
  return { ...baseEvent(), ...overrides };
}

function baseEvent() {
  return {
    id: nextId("event"),
    title: "Fixture event",
    description: null as string | null,
    startDate: new Date("2026-02-18T00:00:00.000Z"),
    endDate: new Date("2026-02-18T00:00:00.000Z"),
    startTime: "10:00" as string | null,
    endTime: "11:00" as string | null,
    isAllDay: false,
    order: 0,
    userId: "user-student" as string | null,
    classroomId: null as string | null,
    courseId: null as string | null,
    testId: null as string | null,
    assignmentId: null as string | null,
    isProtected: false,
    location: null as string | null,
    color: "yellow" as string | null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}

export function buildNotification(overrides: Partial<ReturnType<typeof baseNotification>> = {}) {
  return { ...baseNotification(), ...overrides };
}

function baseNotification() {
  return {
    id: nextId("notification"),
    userId: "user-student",
    title: "Fixture notification",
    body: "A deterministic notification fixture",
    type: "OTHER" as NotificationType,
    category: "GENERAL" as NotificationCategory,
    readAt: null as Date | null,
    relatedId: null as string | null,
    relatedType: null as string | null,
    classroomId: null as string | null,
    classroomName: null as string | null,
    actorId: null as string | null,
    actorName: null as string | null,
    actionUrl: null as string | null,
    createdAt: FIXED_NOW,
  };
}

export function buildFocusSession(overrides: Partial<ReturnType<typeof baseFocusSession>> = {}) {
  return { ...baseFocusSession(), ...overrides };
}

function baseFocusSession() {
  return {
    id: nextId("focus"),
    userId: "user-student",
    completionId: nextId("completion") as string | null,
    durationSeconds: 1_500,
    type: "ACTIVE" as FocusSessionType,
    startedAt: new Date("2026-02-16T09:35:00.000Z"),
    endedAt: FIXED_NOW,
    createdAt: FIXED_NOW,
  };
}

export const TEST_IDENTITIES = {
  teacher: { id: "e2e-teacher", name: "Tess Teacher", email: "teacher@beesmart.test", role: "TEACHER" as ClassroomRole },
  student: { id: "e2e-student", name: "Sam Student", email: "student@beesmart.test", role: "STUDENT" as ClassroomRole },
  outsider: { id: "e2e-outsider", name: "Olive Outsider", email: "outsider@beesmart.test", role: null },
  admin: { id: "e2e-admin", name: "Ada Admin", email: "admin@beesmart.test", role: null },
} as const;

export const TEST_PASSWORD = "BeeSmart-Test-2026!";
