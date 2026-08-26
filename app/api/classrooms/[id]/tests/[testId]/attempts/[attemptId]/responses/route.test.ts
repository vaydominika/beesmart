import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { getCurrentUserId, prisma } from "@/lib/db";
import { PATCH } from "./route";

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn() },
        testAttempt: { findFirst: vi.fn() },
        testQuestion: { findFirst: vi.fn() },
        testAttemptResponse: { findMany: vi.fn(), upsert: vi.fn() },
    },
}));

const context = routeContext({ id: "class-1", testId: "test-1", attemptId: "attempt-1" });

describe("test response draft limits", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({ id: "attempt-1" } as never);
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue({
            id: "question-1",
            questionType: "ESSAY",
            options: [],
        } as never);
        vi.mocked(prisma.testAttemptResponse.findMany).mockResolvedValue([] as never);
    });

    it("rejects an oversized essay before querying or writing response drafts", async () => {
        const response = await PATCH(new NextRequest("http://localhost", {
            method: "PATCH",
            body: JSON.stringify({ questionId: "question-1", responseText: "a".repeat(6_001) }),
        }), context);
        const data = await response.json();

        expect(response.status).toBe(413);
        expect(data.code).toBe("RESPONSE_TOO_LONG");
        expect(prisma.testAttemptResponse.findMany).not.toHaveBeenCalled();
        expect(prisma.testAttemptResponse.upsert).not.toHaveBeenCalled();
    });

    it("requires authentication and learner membership", async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null);
        expect((await PATCH(request({ questionId: "question-1" }), context)).status).toBe(401);
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
        expect((await PATCH(request({ questionId: "question-1" }), context)).status).toBe(403);
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        expect((await PATCH(request({ questionId: "question-1" }), context)).status).toBe(403);
    });

    it("rejects oversized request headers and malformed response fields", async () => {
        const oversized = request({ questionId: "question-1" }, { "content-length": "64001" });
        expect((await PATCH(oversized, context)).status).toBe(413);
        expect((await PATCH(request({}), context)).status).toBe(400);
        expect((await PATCH(request({ questionId: "question-1", responseText: 42 }), context)).status).toBe(400);
        expect((await PATCH(request({ questionId: "question-1", selectedOptionId: 42 }), context)).status).toBe(400);
    });

    it("requires an active attempt and a question in the selected test", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue(null);
        expect((await PATCH(request({ questionId: "question-1" }), context)).status).toBe(404);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({ id: "attempt-1" } as never);
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue(null);
        expect((await PATCH(request({ questionId: "question-1" }), context)).status).toBe(404);
    });

    it("rejects a multiple-choice option from a different question", async () => {
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue({
            id: "question-1", questionType: "MULTIPLE_CHOICE", options: [{ id: "valid" }],
        } as never);
        const response = await PATCH(request({ questionId: "question-1", selectedOptionId: "foreign" }), context);
        expect(response.status).toBe(400);
    });

    it("enforces the total written response allowance while replacing the current answer", async () => {
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue({ id: "question-1", questionType: "SHORT_ANSWER", options: [] } as never);
        vi.mocked(prisma.testAttemptResponse.findMany).mockResolvedValue([
            { questionId: "other", responseText: "x".repeat(12_000) },
            { questionId: "question-1", responseText: "old" },
        ] as never);
        const response = await PATCH(request({ questionId: "question-1", responseText: "new" }), context);
        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toMatchObject({ code: "ATTEMPT_TEXT_TOO_LONG", limit: 12_000 });
    });

    it("upserts a text draft and clears stale grading fields", async () => {
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue({ id: "question-1", questionType: "SHORT_ANSWER", options: [] } as never);
        vi.mocked(prisma.testAttemptResponse.upsert).mockResolvedValue({
            questionId: "question-1", responseText: "  pollen  ", selectedOptionId: null, createdAt: new Date(),
        } as never);
        const response = await PATCH(request({ questionId: "question-1", responseText: "  pollen  " }), context);
        expect(response.status).toBe(200);
        expect(prisma.testAttemptResponse.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ responseText: "  pollen  ", selectedOptionId: null, pointsAwarded: null, aiSuggestedPoints: null }),
            create: expect.objectContaining({ attemptId: "attempt-1", questionId: "question-1", responseText: "  pollen  " }),
        }));
    });

    it("upserts a valid selected option without written text", async () => {
        vi.mocked(prisma.testQuestion.findFirst).mockResolvedValue({
            id: "question-1", questionType: "MULTIPLE_CHOICE", options: [{ id: "option-1" }],
        } as never);
        vi.mocked(prisma.testAttemptResponse.upsert).mockResolvedValue({ questionId: "question-1", responseText: null, selectedOptionId: "option-1" } as never);
        expect((await PATCH(request({ questionId: "question-1", selectedOptionId: "option-1" }), context)).status).toBe(200);
        expect(prisma.testAttemptResponse.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ responseText: null, selectedOptionId: "option-1" }),
        }));
    });
});

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    });
}
