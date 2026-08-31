import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { getCurrentUserId, prisma } from "@/lib/db";
import { DELETE, GET, PATCH } from "./route";
import { notifyClassroomMembers } from "@/lib/notifications";
import { syncTestCalendarEvent } from "@/lib/classroom-test-sync";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    test: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    testAttempt: { aggregate: vi.fn(), findMany: vi.fn() },
    testAttemptResponse: { findMany: vi.fn() },
    classroomPost: { updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/classroom-test-sync", () => ({ syncTestCalendarEvent: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyClassroomMembers: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const context = routeContext({ id: "class-1", testId: "test-1" });

function patch(body: Record<string, unknown>) {
  return PATCH(new NextRequest("http://localhost/api/classrooms/class-1/tests/test-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), context);
}

describe("PATCH test details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1",
      classroomId: "class-1",
      title: "Quiz",
      type: "TEST",
      opensAt: new Date("2099-08-26T08:00:00.000Z"),
      closesAt: new Date("2099-08-26T09:00:00.000Z"),
    } as never);
    vi.mocked(prisma.testAttempt.aggregate).mockResolvedValue({ _max: { attemptNumber: 1 } } as never);
    vi.mocked(prisma.test.update).mockResolvedValue({ id: "test-1", title: "Quiz", description: "Updated instructions", type: "TEST" } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("preserves an explicit zero passing score", async () => {
    const response = await patch({ passingScore: 0, timeLimit: 45, maxAttempts: 2 });
    expect(response.status).toBe(200);
    expect(prisma.test.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ passingScore: 0, timeLimit: 45, maxAttempts: 2 }),
    }));
    expect(prisma.classroomPost.updateMany).toHaveBeenCalledWith({
      where: { testId: "test-1" },
      data: { title: null, content: "Updated instructions", editedAt: expect.any(Date) },
    });
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({ recipientRoles: ["STUDENT"] }));
  });

  it("rejects invalid assessment limits", async () => {
    expect((await patch({ timeLimit: 0 })).status).toBe(400);
    expect((await patch({ passingScore: 101 })).status).toBe(400);
  });
});

describe("test detail lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", classroomId: "class-1", title: "Quiz", description: null, type: "TEST",
      timeLimit: null, passingScore: 50, opensAt: null, closesAt: null, maxAttempts: 2,
    } as never);
    vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([]);
    vi.mocked(prisma.testAttemptResponse.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("requires authentication for every operation", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(401);
    expect((await patch({})).status).toBe(401);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(401);
  });

  it("returns teacher metadata without learner attempt policy", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body).toMatchObject({ id: "test-1", title: "Quiz" });
    expect(body.attemptPolicy).toBeUndefined();
    expect(prisma.testAttempt.findMany).not.toHaveBeenCalled();
  });

  it("builds learner attempt policy and selects the best completed attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T10:00:00Z"));
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", title: "Quiz", type: "TEST", maxAttempts: 3,
      opensAt: new Date("2026-08-26T09:00:00Z"), closesAt: new Date("2026-08-26T11:00:00Z"),
    } as never);
    vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([
      { id: "first", attemptNumber: 1, isCompleted: true, score: 50, startedAt: new Date(), submittedAt: new Date() },
      { id: "best", attemptNumber: 2, isCompleted: true, score: 90, startedAt: new Date(), submittedAt: new Date() },
      { id: "active", attemptNumber: 3, isCompleted: false, score: null, startedAt: new Date(), submittedAt: null },
    ] as never);

    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body.attemptPolicy).toEqual({ maxAttempts: 3, completedAttempts: 2, remainingAttempts: 1, activeAttemptId: "active", nextAttemptNumber: 3, canStart: true });
    expect(body.bestAttempt.id).toBe("best");
    expect(body.questions).toEqual([]);
  });

  it("shows expected answers only for responses that lost points", async () => {
    vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([
      { id: "best", attemptNumber: 1, isCompleted: true, score: 50, startedAt: new Date(), submittedAt: new Date() },
    ] as never);
    vi.mocked(prisma.testAttemptResponse.findMany).mockResolvedValue([
      {
        questionId: "wrong",
        responseText: "Wrong answer",
        pointsAwarded: 1,
        selectedOption: null,
        question: { questionText: "Explain it", points: 4, options: [], answers: [{ answerText: "Expected answer" }] },
      },
      {
        questionId: "correct",
        responseText: "Correct answer",
        pointsAwarded: 2,
        selectedOption: null,
        question: { questionText: "Name it", points: 2, options: [], answers: [{ answerText: "Correct answer" }] },
      },
    ] as never);

    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body.resultReview[0]).toMatchObject({ pointsAwarded: 1, maxPoints: 4, expectedAnswer: "Expected answer" });
    expect(body.resultReview[1]).toMatchObject({ pointsAwarded: 2, maxPoints: 2, expectedAnswer: null });
  });

  it("closes learner access outside the schedule and handles missing resources", async () => {
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", title: "Quiz", type: "TEST", maxAttempts: 1, opensAt: new Date("2099-01-01"), closesAt: null,
    } as never);
    const body = await (await GET(new NextRequest("http://localhost"), context)).json();
    expect(body.attemptPolicy.canStart).toBe(false);

    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(403);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(404);
  });

  it("rejects non-teachers, missing tests, and invalid attempt reductions", async () => {
    expect((await patch({ title: "No" })).status).toBe(403);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue(null);
    expect((await patch({ title: "Missing" })).status).toBe(404);

    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", title: "Quiz", type: "TEST", opensAt: null, closesAt: null,
    } as never);
    vi.mocked(prisma.testAttempt.aggregate).mockResolvedValue({ _max: { attemptNumber: 3 } } as never);
    expect((await patch({ maxAttempts: 2 })).status).toBe(400);
    expect((await patch({ maxAttempts: 0 })).status).toBe(400);
  });

  it("validates schedule ordering and required opening time", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", title: "Quiz", type: "TEST", opensAt: null, closesAt: null,
    } as never);
    expect((await patch({ closesAt: "2099-08-26T10:00:00" })).status).toBe(400);
    expect((await patch({ opensAt: "2099-08-26T11:00:00", closesAt: "2099-08-26T10:00:00" })).status).toBe(400);
    expect((await patch({ opensAt: "invalid" })).status).toBe(400);
  });

  it("skips notifications for an unchanged update but still synchronizes", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue({
      id: "test-1", classroomId: "class-1", title: "Quiz", description: null, type: "TEST", opensAt: null, closesAt: null,
    } as never);
    vi.mocked(prisma.test.update).mockResolvedValue({ id: "test-1", title: "Quiz", description: null, type: "TEST" } as never);
    expect((await patch({ title: "Quiz" })).status).toBe(200);
    expect(prisma.classroomPost.updateMany).not.toHaveBeenCalled();
    expect(notifyClassroomMembers).not.toHaveBeenCalled();
    expect(syncTestCalendarEvent).toHaveBeenCalledWith("test-1");
  });

  it("deletes tests and their posts after notifying learners", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.classroomPost.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.test.delete).mockResolvedValue({ id: "test-1" } as never);
    const response = await DELETE(new NextRequest("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({ title: "Test removed" }));
    expect(prisma.classroomPost.deleteMany).toHaveBeenCalledWith({ where: { testId: "test-1" } });
    expect(prisma.test.delete).toHaveBeenCalledWith({ where: { id: "test-1" } });
  });

  it("enforces teacher and existence checks before delete", async () => {
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(403);
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.test.findFirst).mockResolvedValue(null);
    expect((await DELETE(new NextRequest("http://localhost"), context)).status).toBe(404);
  });
});
