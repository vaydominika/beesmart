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
        test: { findFirst: vi.fn() },
        testAttemptResponse: { upsert: vi.fn(), findMany: vi.fn() },
        $transaction: vi.fn(),
    },
}));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const context = routeContext({ id: "class-1", testId: "test-1" });

describe("complete-set test submission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({ id: "attempt-1", startedAt: new Date() } as never);
        vi.mocked(prisma.test.findFirst).mockResolvedValue({
            id: "test-1", classroomId: "class-1", timeLimit: null,
            questions: [
                { id: "q1", questionType: "MULTIPLE_CHOICE", points: 2, options: [{ id: "o1", isCorrect: true }], answers: [] },
                { id: "q2", questionType: "ESSAY", points: 3, options: [], answers: [] },
            ],
        } as never);
        vi.mocked(prisma.testAttemptResponse.findMany).mockResolvedValue([]);
        vi.mocked(prisma.testAttemptResponse.upsert).mockImplementation(async (args: any) => ({ id: `response-${args.create.questionId}`, ...args.create, ...args.update }) as never);
        vi.mocked(prisma.testAttempt.update).mockImplementation(async (args: any) => ({ id: "attempt-1", attemptNumber: 1, userId: "student-1", ...args.data }) as never);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    });

    it("allows an entirely unanswered submission and counts every question", async () => {
        const response = await POST(new NextRequest("http://localhost", {
            method: "POST",
            body: JSON.stringify({ attemptId: "attempt-1", responses: [] }),
        }), context);
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.totalPoints).toBe(5);
        expect(data.totalScore).toBe(0);
        expect(data.needsManualGrading).toBe(false);
        expect(prisma.testAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ score: 0, isCompleted: true }) }));
    });

    it("rejects an option from a different question", async () => {
        const response = await POST(new NextRequest("http://localhost", {
            method: "POST",
            body: JSON.stringify({ attemptId: "attempt-1", responses: [{ questionId: "q1", selectedOptionId: "other-option" }] }),
        }), context);
        expect(response.status).toBe(400);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
