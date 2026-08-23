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
});
