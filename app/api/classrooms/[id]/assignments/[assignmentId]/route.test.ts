import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeContext } from "@/test-utils/route-context";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroomMember: { findUnique: vi.fn() },
    assignedWork: { findFirst: vi.fn() },
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
      where: expect.objectContaining({
        id: "assignment-1",
        classroomId: "class-1",
        OR: [{ assignedToId: null }, { assignedToId: "user-1" }],
      }),
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
