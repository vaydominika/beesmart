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

    it("requires authentication and learner membership", async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(401);
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(403);
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(403);
    });

    it("requires a test scoped to the classroom", async () => {
        vi.mocked(prisma.test.findFirst).mockResolvedValue(null);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(404);
    });

    it("enforces opening and closing windows", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-26T10:00:00Z"));
        vi.mocked(prisma.test.findFirst).mockResolvedValue({ ...test, opensAt: new Date("2026-08-26T11:00:00Z") } as never);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(400);
        vi.mocked(prisma.test.findFirst).mockResolvedValue({ ...test, closesAt: new Date("2026-08-26T09:00:00Z") } as never);
        expect((await POST(new Request("http://localhost"), context)).status).toBe(400);
    });

    it("returns the transaction winner when another request creates the attempt first", async () => {
        const winner = {
            id: "winner", userId: "student-1", attemptNumber: 2, startedAt: new Date(), submittedAt: null,
            isCompleted: false, score: null, responses: [],
        };
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(winner as never);
        const response = await POST(new Request("http://localhost"), context);
        expect(response.status).toBe(201);
        expect((await response.json()).attempt.id).toBe("winner");
        expect(prisma.testAttempt.create).not.toHaveBeenCalled();
    });

    it("converts the transactional attempt limit race to a conflict", async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error("ATTEMPT_LIMIT_REACHED"));
        const response = await POST(new Request("http://localhost"), context);
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe("ATTEMPT_LIMIT_REACHED");
    });

    it("recovers from a unique-key race by returning the winning active attempt", async () => {
        const winner = {
            id: "winner", userId: "student-1", attemptNumber: 1, startedAt: new Date(), submittedAt: null,
            isCompleted: false, score: null, responses: [],
        };
        vi.mocked(prisma.$transaction).mockRejectedValue({ code: "P2002" });
        vi.mocked(prisma.testAttempt.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(winner as never);
        const response = await POST(new Request("http://localhost"), context);
        expect(response.status).toBe(200);
        expect((await response.json()).attempt.id).toBe("winner");
    });

    it("logs and hides unexpected transaction failures", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error("database secret"));
        const response = await POST(new Request("http://localhost"), context);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Server error" });
        expect(error).toHaveBeenCalledWith("POST start test", expect.any(Error));
        error.mockRestore();
    });
});
