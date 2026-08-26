import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn(), findMany: vi.fn() },
        assignedWork: { findMany: vi.fn() },
        test: { findMany: vi.fn() },
        grade: { findMany: vi.fn() },
        submission: { findMany: vi.fn() },
        testAttempt: { findMany: vi.fn() },
    },
}));

const context = routeContext({ id: "class-1" });

describe("GET classroom gradebook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        vi.mocked(prisma.assignedWork.findMany).mockResolvedValue([]);
        vi.mocked(prisma.test.findMany).mockResolvedValue([]);
        vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([]);
        vi.mocked(prisma.grade.findMany).mockResolvedValue([]);
        vi.mocked(prisma.submission.findMany).mockResolvedValue([]);
        vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([]);
    });

    it("only includes assignments and tests that still have a classroom post", async () => {
        const response = await GET(new NextRequest("http://localhost"), context);

        expect(response.status).toBe(200);
        expect(prisma.assignedWork.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                classroomId: "class-1",
                posts: { some: { classroomId: "class-1" } },
            },
        }));
        expect(prisma.test.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                classroomId: "class-1",
                posts: { some: { classroomId: "class-1" } },
            },
        }));
    });

    it("only returns class-wide or directly assigned work to a learner", async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);

        const response = await GET(new NextRequest("http://localhost"), context);

        expect(response.status).toBe(200);
        expect(prisma.assignedWork.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                OR: [{ assignedToId: null }, { assignedToId: "student-1" }],
            }),
        }));
    });

    it("requires authentication and classroom membership", async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue(null);
        expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(401);

        vi.mocked(getCurrentUserId).mockResolvedValue("outsider-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
        expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(403);
    });

    it("builds the learner gradebook and selects the best test attempt", async () => {
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.assignedWork.findMany).mockResolvedValue([
            { id: "assignment-1", title: "Essay", maxPoints: 20 },
            { id: "assignment-2", title: "Optional", maxPoints: 5 },
        ] as never);
        vi.mocked(prisma.test.findMany).mockResolvedValue([{ id: "test-1", title: "Quiz", type: "QUIZ" }] as never);
        vi.mocked(prisma.grade.findMany).mockResolvedValue([{ assignedWorkId: "assignment-1", score: 18, maxScore: 20, feedback: "Great" }] as never);
        vi.mocked(prisma.submission.findMany).mockResolvedValue([{ assignedWorkId: "assignment-1", status: "GRADED", submittedAt: new Date("2026-08-20") }] as never);
        vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([
            { id: "attempt-1", testId: "test-1", score: 5, submittedAt: new Date("2026-08-22") },
            { id: "attempt-2", testId: "test-1", score: 9, submittedAt: new Date("2026-08-21") },
        ] as never);

        const body = await (await GET(new NextRequest("http://localhost"), context)).json();
        expect(body.role).toBe("STUDENT");
        expect(body.assignments[0]).toMatchObject({ grade: { score: 18, feedback: "Great" }, submission: { status: "GRADED" } });
        expect(body.assignments[1]).toMatchObject({ grade: null, submission: null });
        expect(body.tests[0].attempt).toMatchObject({ id: "attempt-2", score: 9 });
    });

    it("builds a teacher matrix with grade and submission fallbacks", async () => {
        vi.mocked(prisma.assignedWork.findMany).mockResolvedValue([{ id: "assignment-1", title: "Essay", maxPoints: 20 }] as never);
        vi.mocked(prisma.test.findMany).mockResolvedValue([{ id: "test-1", title: "Quiz", type: "QUIZ" }] as never);
        vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([
            { userId: "student-1", user: { id: "student-1", name: "Ada" } },
            { userId: "student-2", user: { id: "student-2", name: "Grace" } },
        ] as never);
        vi.mocked(prisma.grade.findMany).mockResolvedValue([{ assignedWorkId: "assignment-1", userId: "student-1", score: 17, maxScore: 20 }] as never);
        vi.mocked(prisma.submission.findMany).mockResolvedValue([{ assignedWorkId: "assignment-1", userId: "student-1", status: "GRADED", submittedAt: new Date("2026-08-20") }] as never);
        vi.mocked(prisma.testAttempt.findMany).mockResolvedValue([
            { id: "old", userId: "student-1", testId: "test-1", score: 4, submittedAt: new Date("2026-08-20") },
            { id: "new", userId: "student-1", testId: "test-1", score: 7, submittedAt: new Date("2026-08-21") },
        ] as never);

        const body = await (await GET(new NextRequest("http://localhost"), context)).json();
        expect(body.role).toBe("TEACHER");
        expect(body.students[0].assignmentGrades[0]).toMatchObject({ score: 17, maxScore: 20, submissionStatus: "GRADED" });
        expect(body.students[0].testGrades[0]).toMatchObject({ attemptId: "new", score: 7 });
        expect(body.students[1].assignmentGrades[0]).toMatchObject({ score: null, maxScore: 20, submissionStatus: null });
        expect(body.students[1].testGrades[0]).toMatchObject({ attemptId: null, score: null });
    });

    it("logs internal errors without exposing them", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(prisma.assignedWork.findMany).mockRejectedValue(new Error("database password"));
        const response = await GET(new NextRequest("http://localhost"), context);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Server error" });
        expect(error).toHaveBeenCalledWith("GET gradebook", expect.any(Error));
        error.mockRestore();
    });
});
