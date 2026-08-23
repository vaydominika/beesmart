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
});
