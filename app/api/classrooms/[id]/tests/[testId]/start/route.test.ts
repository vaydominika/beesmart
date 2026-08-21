import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn() },
        test: { findFirst: vi.fn() },
        testAttempt: { findFirst: vi.fn(), count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
        $transaction: vi.fn(),
    },
}));

const context = routeContext({ id: "class-1", testId: "test-1" });
const test = {
    id: "test-1", classroomId: "class-1", title: "Bees", description: null, type: "TEST",
    timeLimit: null, passingScore: 50, opensAt: null, closesAt: null, maxAttempts: 1,
    questions: [{ id: "q1", questionText: "Hive?", questionType: "SHORT_ANSWER", points: 1, options: [] }],
};

describe("explicit test start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.test.findFirst).mockResolvedValue(test as never);
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.testAttempt.count).mockResolvedValue(0);
        vi.mocked(prisma.testAttempt.aggregate).mockResolvedValue({ _max: { attemptNumber: null } } as never);
        vi.mocked(prisma.testAttempt.create).mockResolvedValue({
            id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: new Date(), submittedAt: null,
            isCompleted: false, score: null, responses: [],
        } as never);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    });

    it("scopes the test to the classroom and creates the first numbered attempt", async () => {
        const response = await POST(new Request("http://localhost", { method: "POST" }), context);
        const data = await response.json();
        expect(response.status).toBe(201);
        expect(prisma.test.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "test-1", classroomId: "class-1" } }));
        expect(prisma.testAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: { testId: "test-1", userId: "student-1", attemptNumber: 1 } }));
        expect(data.attempt.attemptNumber).toBe(1);
    });

    it("returns an incomplete attempt and its stored responses instead of creating another", async () => {
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValue({
            id: "attempt-1", userId: "student-1", attemptNumber: 1, startedAt: new Date(), submittedAt: null,
            isCompleted: false, score: null, responses: [{ questionId: "q1", responseText: "Honey", selectedOptionId: null }],
        } as never);
        const data = await (await POST(new Request("http://localhost", { method: "POST" }), context)).json();
        expect(data.responses).toEqual([{ questionId: "q1", responseText: "Honey", selectedOptionId: null }]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("enforces the submitted-attempt limit", async () => {
        vi.mocked(prisma.testAttempt.count).mockResolvedValue(1);
        const response = await POST(new Request("http://localhost", { method: "POST" }), context);
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe("ATTEMPT_LIMIT_REACHED");
    });
});
