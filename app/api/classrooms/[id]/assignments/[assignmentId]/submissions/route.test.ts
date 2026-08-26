import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { routeContext } from "@/test-utils/route-context";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { recordMeaningfulActivity } from "@/lib/activity";
import { claimUploads, markFilesForDeletion, purgeStoredFiles, UploadClaimError } from "@/lib/files/lifecycle";

vi.mock("@/lib/activity", () => ({ recordMeaningfulActivity: vi.fn() }));
vi.mock("@/lib/files/lifecycle", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/files/lifecycle")>();
    return {
        ...original,
        claimUploads: vi.fn(),
        markFilesForDeletion: vi.fn(),
        purgeStoredFiles: vi.fn(),
    };
});

vi.mock("@/lib/db", () => ({
    getCurrentUserId: vi.fn(),
    prisma: {
        classroomMember: { findUnique: vi.fn(), findMany: vi.fn() },
        assignedWork: { findFirst: vi.fn() },
        submission: { findUnique: vi.fn(), findMany: vi.fn() },
        grade: { findFirst: vi.fn(), findMany: vi.fn() },
        $transaction: vi.fn(),
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

    it("returns pending students and rewrites stored file URLs", async () => {
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
        vi.mocked(prisma.submission.findMany).mockResolvedValue([{
            id: "submission-1", userId: "student-1", files: [{ id: "file-1", storedFileId: "stored-1", fileUrl: null }],
        }] as never);
        vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([
            { userId: "student-1", user: { id: "student-1", name: "Ada" } },
            { userId: "student-2", user: { id: "student-2", name: "Grace" } },
        ] as never);
        vi.mocked(prisma.grade.findMany).mockResolvedValue([]);

        const body = await (await GET(new NextRequest("http://localhost"), context)).json();
        expect(body.submissions[0].files[0].fileUrl).toBe("/api/files/stored-1");
        expect(body.notSubmitted).toEqual([{ user: { id: "student-2", name: "Grace" }, status: "PENDING" }]);
    });

    it("returns an empty list when a learner has not submitted", async () => {
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.submission.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.grade.findFirst).mockResolvedValue(null);
        expect(await (await GET(new NextRequest("http://localhost"), context)).json()).toEqual([]);
    });

    it("enforces membership and assignment visibility", async () => {
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
        expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(403);
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue(null);
        expect((await GET(new NextRequest("http://localhost"), context)).status).toBe(404);
    });
});

describe("POST assignment submission", () => {
    const tx = {
        storedFile: { findMany: vi.fn(), updateMany: vi.fn() },
        submission: { upsert: vi.fn() },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({ id: "assignment-1", deadlineAt: new Date("2099-01-01") } as never);
        vi.mocked(prisma.submission.findUnique).mockResolvedValue(null);
        vi.mocked(claimUploads).mockResolvedValue([]);
        tx.submission.upsert.mockResolvedValue({ id: "submission-1", files: [] });
        vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof tx) => unknown) => callback(tx)) as never);
    });

    it("requires authentication, membership, and a visible assignment", async () => {
        const request = () => new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ content: "answer" }) });
        vi.mocked(getCurrentUserId).mockResolvedValue(null);
        expect((await POST(request(), context)).status).toBe(401);
        vi.mocked(getCurrentUserId).mockResolvedValue("student-1");
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
        expect((await POST(request(), context)).status).toBe(403);
        vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
        vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue(null);
        expect((await POST(request(), context)).status).toBe(404);
    });

    it("creates an on-time text submission and records activity", async () => {
        const response = await POST(new NextRequest("http://localhost", {
            method: "POST", body: JSON.stringify({ content: "  My answer  ", uploadIds: "invalid" }),
        }), context);

        expect(response.status).toBe(200);
        expect(claimUploads).toHaveBeenCalledWith(tx, [], "student-1", "SUBMISSION_ATTACHMENT");
        expect(tx.submission.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ content: "My answer", status: "SUBMITTED", files: undefined }),
        }));
        expect(recordMeaningfulActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "ASSIGNMENT_SUBMITTED" }));
    });

    it("replaces attachments, marks an overdue resubmission late, and purges old files", async () => {
        vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({ id: "assignment-1", deadlineAt: new Date("2000-01-01") } as never);
        vi.mocked(prisma.submission.findUnique).mockResolvedValue({ files: [{ storedFileId: "old-1" }, { storedFileId: null }] } as never);
        vi.mocked(claimUploads).mockResolvedValue([{ id: "new-1", originalName: "work.pdf", fileType: "application/pdf", size: 42 }] as never);
        tx.submission.upsert.mockResolvedValue({ id: "submission-1", files: [{ storedFileId: "new-1", fileUrl: null }] });

        const body = await (await POST(new NextRequest("http://localhost", {
            method: "POST", body: JSON.stringify({ content: "", uploadIds: ["new-1"] }),
        }), context)).json();

        expect(markFilesForDeletion).toHaveBeenCalledWith(tx, ["old-1"]);
        expect(purgeStoredFiles).toHaveBeenCalledWith(["old-1"]);
        expect(tx.submission.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ content: null, status: "LATE", files: expect.any(Object) }),
        }));
        expect(body.files[0].fileUrl).toBe("/api/files/new-1");
    });

    it("returns a safe validation response for unavailable uploads", async () => {
        vi.mocked(claimUploads).mockRejectedValue(new UploadClaimError("Upload expired"));
        const response = await POST(new NextRequest("http://localhost", {
            method: "POST", body: JSON.stringify({ uploadIds: ["gone"] }),
        }), context);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Upload expired" });
    });

    it("logs and hides unexpected failures", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.mocked(prisma.classroomMember.findUnique).mockRejectedValue(new Error("database secret"));
        const response = await POST(new NextRequest("http://localhost", { method: "POST", body: "{}" }), context);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Server error" });
        expect(error).toHaveBeenCalledWith("POST submission", expect.any(Error));
        error.mockRestore();
    });
});
