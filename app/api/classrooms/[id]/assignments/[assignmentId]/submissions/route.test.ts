import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn(), findMany: vi.fn() },
        assignedWork: { findFirst: vi.fn() },
        submission: { findUnique: vi.fn(), findMany: vi.fn() },
        grade: { findFirst: vi.fn(), findMany: vi.fn() },
    },
}));

const context = routeContext({ id: "class-1", assignmentId: "assignment-1" });

describe("GET assignment submissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({ id: "assignment-1" } as never);
    });

    it("returns only the learner's submission with its score and feedback", async () => {
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.submission.findUnique).mockResolvedValue({
            id: "submission-1", userId: "student-1", status: "GRADED", submittedAt: new Date(), files: [], comments: [],
        } as never);
        vi.mocked(prisma.grade.findFirst).mockResolvedValue({ score: 18, maxScore: 20, feedback: "Clear work.", gradedAt: new Date() } as never);

        const response = await GET(new NextRequest("http://localhost"), context);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0].grade).toMatchObject({ score: 18, maxScore: 20, feedback: "Clear work." });
        expect(prisma.submission.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { assignedWorkId_userId: { assignedWorkId: "assignment-1", userId: "student-1" } },
        }));
    });

    it("attaches each grade to the matching submission for teachers", async () => {
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        vi.mocked(prisma.submission.findMany).mockResolvedValue([{ id: "submission-1", userId: "student-1", files: [] }] as never);
        vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([{ userId: "student-1", user: { id: "student-1", name: "Ada" } }] as never);
        vi.mocked(prisma.grade.findMany).mockResolvedValue([{ userId: "student-1", score: 9, maxScore: 10, feedback: null }] as never);

        const body = await (await GET(new NextRequest("http://localhost"), context)).json();

        expect(body.submissions[0].grade).toMatchObject({ score: 9, maxScore: 10 });
    });
});
