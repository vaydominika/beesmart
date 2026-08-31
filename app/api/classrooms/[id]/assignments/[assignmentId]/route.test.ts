import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { DELETE, GET, PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { syncAssignmentCalendarEvent } from "@/lib/classroom-assignment-sync";
import { notifyClassroomMembers } from "@/lib/notifications";

vi.mock("@/lib/classroom-assignment-sync", () => ({ syncAssignmentCalendarEvent: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyClassroomMembers: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    assignedWork: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    grade: { deleteMany: vi.fn() },
    submission: { updateMany: vi.fn() },
    classroomPost: { updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const context = routeContext({ id: "class-1", assignmentId: "assignment-1" });

describe("GET assignment details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(401);
  });

  it("requires classroom membership", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(403);
  });

  it("scopes the assignment query to the classroom", async () => {
    vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(404);
    expect(prisma.assignedWork.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "assignment-1",
        classroomId: "class-1",
      },
    }));
  });

  it("returns assigner details and post attachments", async () => {
    vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({
      id: "assignment-1", title: "Essay", description: null, deadlineAt: new Date(), deadlineTimeZone: "Europe/Budapest", deadlineHasTime: false,
      isGraded: true, maxPoints: 20, createdAt: new Date(), assigner: { id: "teacher-1", name: "Teacher", avatar: null },
      posts: [{ files: [{ id: "file-1", fileName: "brief.pdf", fileUrl: "/brief.pdf", fileType: "PDF", fileSize: 42 }] }],
    } as never);
    const data = await (await GET(new Request("http://localhost"), context)).json();
    expect(data.assigner.name).toBe("Teacher");
    expect(data.files).toHaveLength(1);
    expect(data.viewerRole).toBe("STUDENT");
  });
});

describe("PATCH assignment details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({
      id: "assignment-1",
      classroomId: "class-1",
      title: "Essay",
      description: null,
      deadlineAt: new Date("2099-08-26T19:00:00.000Z"),
      deadlineTimeZone: "Europe/Budapest",
      deadlineHasTime: true,
      isGraded: true,
      maxPoints: 100,
    } as never);
    vi.mocked(prisma.assignedWork.update).mockResolvedValue({
      id: "assignment-1",
      title: "Revised essay",
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("rejects student edits", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ title: "No" }) }) as never, context);
    expect(response.status).toBe(403);
  });

  it("updates the assignment, its post, and its synchronized event", async () => {
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Revised essay",
        description: "New instructions",
        dueDate: "2099-08-27",
        dueTime: "21:00",
        timeZone: "Europe/Budapest",
        isGraded: true,
        maxPoints: 80,
      }),
    }) as never, context);

    expect(response.status).toBe(200);
    expect(prisma.assignedWork.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "assignment-1" },
      data: expect.objectContaining({ title: "Revised essay", isGraded: true, maxPoints: 80 }),
    }));
    expect(prisma.classroomPost.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { assignmentId: "assignment-1" },
      data: expect.objectContaining({ title: null, editedAt: expect.any(Date) }),
    }));
    expect(syncAssignmentCalendarEvent).toHaveBeenCalledWith("assignment-1");
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({ recipientRoles: ["STUDENT"] }));
  });

  it("removes existing grades when grading is switched off", async () => {
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isGraded: false }),
    }) as never, context);

    expect(response.status).toBe(200);
    expect(prisma.assignedWork.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isGraded: false, maxPoints: null }),
    }));
    expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { assignedWorkId: "assignment-1" } });
    expect(prisma.submission.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignedWorkId: "assignment-1", status: "GRADED" }),
      data: { status: "LATE" },
    }));
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignedWorkId: "assignment-1", status: "GRADED" }),
      data: { status: "SUBMITTED" },
    }));
  });
});

describe("DELETE assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("teacher-1");
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "TEACHER" } as never);
    vi.mocked(prisma.assignedWork.findFirst).mockResolvedValue({ id: "assignment-1", title: "Essay" } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
  });

  it("rejects student deletion", async () => {
    vi.mocked(prisma.classroomMember.findUnique).mockResolvedValue({ role: "STUDENT" } as never);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, context)).status).toBe(403);
  });

  it("deletes the assignment and its structured post", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }) as never, context);

    expect(response.status).toBe(200);
    expect(prisma.classroomPost.deleteMany).toHaveBeenCalledWith({ where: { assignmentId: "assignment-1" } });
    expect(prisma.assignedWork.delete).toHaveBeenCalledWith({ where: { id: "assignment-1" } });
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({
      title: "Assignment removed",
      recipientRoles: ["STUDENT"],
    }));
  });
});
