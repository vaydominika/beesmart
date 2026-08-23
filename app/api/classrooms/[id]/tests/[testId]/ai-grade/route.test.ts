import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { getCurrentUserId, prisma } from "@/lib/db";
import { reserveAiAttempt } from "@/lib/ai/usage";
import { POST } from "./route";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/deepseek", () => ({ deepseek: vi.fn(() => "model") }));
vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn() },
        testAttempt: { findFirst: vi.fn() },
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

const context = routeContext({ id: "class-1", testId: "test-1" });
const request = () => new NextRequest("http://localhost", {
    method: "POST",
    body: JSON.stringify({ attemptId: "attempt-1" }),
});
const essayResponse = (overrides: Record<string, unknown> = {}) => ({
    id: "response-1",
    responseText: "A clear learner response.",
    pointsAwarded: null,
    aiSuggestedPoints: null,
    aiSuggestedFeedback: null,
    aiSuggestedConfidence: null,
    question: {
        questionText: "Explain the main idea.",
        questionType: "ESSAY",
        points: 5,
        answers: [{ answerText: "A reference answer." }],
    },
    ...overrides,
});

describe("AI essay grading drafts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            test: { title: "Final" },
            responses: [essayResponse()],
        } as never);
        vi.mocked(reserveAiAttempt).mockResolvedValue({
            category: "GRADING", used: 1, remaining: 34, limit: 35, resetsAt: "2026-08-24T00:00:00.000Z",
        });
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    });

    it("rejects oversized legacy essays before quota or AI use", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            test: { title: "Final" },
            responses: [essayResponse({ responseText: "a".repeat(6_001) })],
        } as never);

        const response = await POST(request(), context);
        const data = await response.json();

        expect(response.status).toBe(413);
        expect(data.code).toBe("GRADING_RESPONSE_TOO_LONG");
        expect(reserveAiAttempt).not.toHaveBeenCalled();
        expect(generateObject).not.toHaveBeenCalled();
    });

    it("returns persisted drafts without spending quota again", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1",
            test: { title: "Final" },
            responses: [essayResponse({
                aiSuggestedPoints: 4,
                aiSuggestedFeedback: "Good explanation.",
                aiSuggestedConfidence: "HIGH",
            })],
        } as never);

        const response = await POST(request(), context);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.cached).toBe(true);
        expect(data.suggestions[0]).toMatchObject({ suggestedScore: 4, confidence: "HIGH" });
        expect(reserveAiAttempt).not.toHaveBeenCalled();
        expect(generateObject).not.toHaveBeenCalled();
    });

    it("uses the separate grading allowance and persists review-only drafts", async () => {
        vi.mocked(generateObject).mockResolvedValue({
            object: {
                suggestions: [{
                    responseId: "response-1",
                    suggestedScore: 4,
                    feedback: "Strong answer; add one example.",
                    confidence: "MEDIUM",
                }],
            },
        } as never);

        const response = await POST(request(), context);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(reserveAiAttempt).toHaveBeenCalledWith("teacher-1", "GRADING");
        expect(prisma.testAttemptResponse.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "response-1" },
            data: expect.objectContaining({
                aiSuggestedPoints: 4,
                aiSuggestedFeedback: "Strong answer; add one example.",
                aiSuggestedConfidence: "MEDIUM",
            }),
        }));
        expect(data.suggestions[0]).toMatchObject({ responseId: "response-1", suggestedScore: 4 });
    });
});
