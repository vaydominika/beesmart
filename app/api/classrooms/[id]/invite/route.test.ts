import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        classroom: { findUnique: vi.fn() },
        user: { findUnique: vi.fn() },
        classroomInvitation: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        courseAccess: { createMany: vi.fn() },
        notification: { create: vi.fn() },
    },
}));

describe("classroom teacher invitations", () => {
    const context = routeContext({ id: "class-1" });

    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentUserId as any).mockResolvedValue("teacher-1");
        (prisma.classroomMember.findUnique as any).mockResolvedValueOnce({ role: "TEACHER" });
        (prisma.classroom.findUnique as any).mockResolvedValue({
            name: "Mathematics",
            code: "ABC123",
            courseLinks: [],
        });
    });

    it("adds an existing user as a teacher", async () => {
        (prisma.user.findUnique as any).mockResolvedValue({
            id: "teacher-2",
            name: "Second Teacher",
            email: "teacher@example.com",
            avatar: null,
        });
        (prisma.classroomMember.findUnique as any).mockResolvedValueOnce(null);
        (prisma.classroomMember.create as any).mockResolvedValue({ id: "member-2", role: "TEACHER" });

        const request = new NextRequest("http://localhost/api/classrooms/class-1/invite", {
            method: "POST",
            body: JSON.stringify({ email: "teacher@example.com", role: "TEACHER" }),
        });
        const response = await POST(request, context);
        const result = await response.json();

        expect(response.status).toBe(201);
        expect(result.status).toBe("added");
        expect(prisma.classroomMember.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { userId: "teacher-2", classroomId: "class-1", role: "TEACHER" },
        }));
    });

    it("keeps an invitation pending when the user is not registered", async () => {
        (prisma.user.findUnique as any).mockResolvedValue(null);
        (prisma.classroomInvitation.findFirst as any).mockResolvedValue(null);
        (prisma.classroomInvitation.create as any).mockResolvedValue({ id: "invite-1" });

        const request = new NextRequest("http://localhost/api/classrooms/class-1/invite", {
            method: "POST",
            body: JSON.stringify({ email: "new@example.com", role: "TEACHING_ASSISTANT" }),
        });
        const response = await POST(request, context);
        const result = await response.json();

        expect(response.status).toBe(201);
        expect(result).toEqual({ status: "invited", classroomCode: "ABC123" });
        expect(prisma.classroomInvitation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                classroomId: "class-1",
                email: "new@example.com",
                role: "TEACHING_ASSISTANT",
                invitedById: "teacher-1",
            }),
        });
    });
});
