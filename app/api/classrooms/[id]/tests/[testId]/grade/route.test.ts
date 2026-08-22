import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    testAttempt: { findFirst: vi.fn(), update: vi.fn() },
    testAttemptResponse: { update: vi.fn() },
    test: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/notifications", () => ({ notifyClassroomUser: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const context = routeContext({ id: "class-1", testId: "test-1" });
const request = (pointsAwarded: number) => new NextRequest("http://localhost", {
  method: "POST",
  body: JSON.stringify({ attemptId: "attempt-1", grades: [{ responseId: "response-1", pointsAwarded, teacherComment: "Reviewed" }] }),
});

describe("strict test grading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
      id: "attempt-1", userId: "student-1", isCompleted: true,
      test: { questions: [{ id: "question-1", points: 2 }, { id: "question-2", points: 3 }] },
      responses: [{ id: "response-1", pointsAwarded: null, question: { id: "question-1", points: 2, questionType: "ESSAY" } }],
    } as never);
    vi.mocked(prisma.testAttempt.update).mockImplementation((async (args: { data: { score: number } }) => ({ id: "attempt-1", userId: "student-1", score: args.data.score })) as never);
    vi.mocked(prisma.test.findUnique).mockResolvedValue({ title: "Final" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it("rejects learners", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    expect((await POST(request(2), context)).status).toBe(403);
  });

  it("rejects points above the question maximum", async () => {
    const response = await POST(request(3), context);
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses every test question in the denominator, including unanswered questions", async () => {
    const response = await POST(request(2), context);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.totalPoints).toBe(5);
    expect(data.totalScore).toBe(2);
    expect(prisma.testAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: { score: 40 } }));
  });
});
