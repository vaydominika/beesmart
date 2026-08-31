import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { getCurrentUserId, prisma } from "@/lib/db";
import { reserveAiAttempt } from "@/lib/ai/usage";
import { notifyClassroomUser } from "@/lib/notifications";
import { POST } from "./route";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));
vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn() },
        testAttempt: { findFirst: vi.fn(), update: vi.fn() },
        testAttemptResponse: { update: vi.fn() },
        $transaction: vi.fn(),
    },
}));
vi.mock("@/lib/ai/usage", () => ({
    AiDailyLimitError: class AiDailyLimitError extends Error {},
    reserveAiAttempt: vi.fn(),
    aiLimitResponse: vi.fn(),
    withAiUsage: (response: Response) => response,
}));
vi.mock("@/lib/notifications", () => ({ notifyClassroomUser: vi.fn() }));
vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));

const context = routeContext({ id: "class-1", testId: "test-1" });
const request = () => new NextRequest("http://localhost", {
    method: "POST",
    body: JSON.stringify({ attemptId: "attempt-1" }),
});
const essayResponse = (overrides: Record<string, unknown> = {}) => ({
    id: "response-1",
    questionId: "essay-1",
    responseText: "A clear learner response.",
    pointsAwarded: null,
    question: {
        questionText: "Explain the main idea.",
        questionType: "ESSAY",
        points: 5,
        answers: [{ answerText: "A reference answer." }],
    },
    ...overrides,
});

describe("direct AI essay grading", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            userId: "student-1",
            score: null,
            test: {
                title: "Final",
                questions: [{ id: "essay-1", points: 5 }, { id: "choice-1", points: 5 }],
            },
            responses: [
                essayResponse(),
                {
                    id: "response-2",
                    questionId: "choice-1",
                    responseText: null,
                    pointsAwarded: 5,
                    question: { questionText: "Choose", questionType: "MULTIPLE_CHOICE", points: 5, answers: [] },
                },
            ],
        } as never);
        vi.mocked(reserveAiAttempt).mockResolvedValue({
            category: "GRADING", used: 1, remaining: 34, limit: 35, resetsAt: "2026-08-24T00:00:00.000Z",
        });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    });

    it("rejects oversized essays before quota or AI use", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            userId: "student-1",
            score: null,
            test: { title: "Final", questions: [{ id: "essay-1", points: 5 }] },
            responses: [essayResponse({ responseText: "a".repeat(6_001) })],
        } as never);

        const response = await POST(request(), context);
        expect(response.status).toBe(413);
        expect((await response.json()).code).toBe("GRADING_RESPONSE_TOO_LONG");
        expect(reserveAiAttempt).not.toHaveBeenCalled();
        expect(generateObject).not.toHaveBeenCalled();
    });

    it("does not spend quota when the attempt has no ungraded essays", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            userId: "student-1",
            score: 80,
            test: { title: "Final", questions: [{ id: "essay-1", points: 5 }] },
            responses: [essayResponse({ pointsAwarded: 4 })],
        } as never);

        const response = await POST(request(), context);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ gradedCount: 0, score: 80 });
        expect(reserveAiAttempt).not.toHaveBeenCalled();
        expect(generateObject).not.toHaveBeenCalled();
    });

    it("writes only awarded points and finalizes the attempt score", async () => {
        vi.mocked(generateObject).mockResolvedValue({
            object: { grades: [{ responseId: "response-1", pointsAwarded: 3 }] },
        } as never);

        const response = await POST(request(), context);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(reserveAiAttempt).toHaveBeenCalledWith("teacher-1", "GRADING");
        expect(prisma.testAttemptResponse.update).toHaveBeenCalledWith({
            where: { id: "response-1" },
            data: { pointsAwarded: 3, isCorrect: false },
        });
        expect(prisma.testAttempt.update).toHaveBeenCalledWith({
            where: { id: "attempt-1" },
            data: { score: 80 },
        });
        expect(data).toMatchObject({ gradedCount: 1, score: 80, totalScore: 8, totalPoints: 10 });
        expect(data).not.toHaveProperty("suggestions");
        expect(notifyClassroomUser).toHaveBeenCalledWith("student-1", expect.objectContaining({ type: "GRADE" }));
    });
});
