import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        $transaction: vi.fn(),
        storedFile: { updateMany: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
        classroomMember: { findUnique: vi.fn() },
        classroomPost: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
    getCurrentUserId: vi.fn(),
}));

describe("classroom post ownership", () => {
    const context = routeContext({ id: "class-1", postId: "post-1" });

    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.$transaction as any).mockImplementation((callback: any) => callback(prisma));
        (prisma.storedFile.findMany as any).mockResolvedValue([]);
        (getCurrentUserId as any).mockResolvedValue("author-1");
        (prisma.classroomPost.findUnique as any).mockResolvedValue({
            id: "post-1",
            classroomId: "class-1",
            authorId: "author-1",
            title: null,
            content: "Original",
            assignmentId: null,
            testId: null,
            courseId: null,
            _count: { files: 0 },
            files: [],
        });
        (prisma.classroomPost.update as any).mockResolvedValue({ id: "post-1", content: "Updated", files: [] });
        (prisma.classroomPost.delete as any).mockResolvedValue({ id: "post-1" });
    });

    it.each(["STUDENT", "TEACHER"])("lets a %s edit their own post", async (role) => {
        (prisma.classroomMember.findUnique as any).mockResolvedValue({ role });
        const request = new NextRequest("http://localhost/api/classrooms/class-1/posts/post-1", {
            method: "PATCH",
            body: JSON.stringify({ content: "Updated" }),
        });

        const response = await PATCH(request, context);

        expect(response.status).toBe(200);
        expect(prisma.classroomPost.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "post-1" },
            data: { content: "Updated" },
        }));
    });

    it("does not let a teacher edit another author's text", async () => {
        (getCurrentUserId as any).mockResolvedValue("teacher-2");
        (prisma.classroomMember.findUnique as any).mockResolvedValue({ role: "TEACHER" });
        const request = new NextRequest("http://localhost/api/classrooms/class-1/posts/post-1", {
            method: "PATCH",
            body: JSON.stringify({ content: "Changed by someone else" }),
        });

        const response = await PATCH(request, context);

        expect(response.status).toBe(403);
        expect(prisma.classroomPost.update).not.toHaveBeenCalled();
    });

    it.each(["STUDENT", "TEACHER"])("lets a %s delete their own post", async (role) => {
        (prisma.classroomMember.findUnique as any).mockResolvedValue({ role });
        const request = new NextRequest("http://localhost/api/classrooms/class-1/posts/post-1", {
            method: "DELETE",
        });

        const response = await DELETE(request, context);

        expect(response.status).toBe(200);
        expect(prisma.classroomPost.delete).toHaveBeenCalledWith({ where: { id: "post-1" } });
    });
});
