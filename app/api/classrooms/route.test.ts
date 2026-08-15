import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    classroom: { findUnique: vi.fn(), create: vi.fn() },
    classroomMember: { findMany: vi.fn() },
  },
}));

describe("/api/classrooms ownership metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
  });

  it("marks only classrooms created by the current user as owned", async () => {
    vi.mocked(prisma.classroomMember.findMany).mockResolvedValue([
      {
        role: "TEACHER",
        classroom: {
          id: "owned",
          name: "Owned classroom",
          description: null,
          code: "OWN123",
          subject: null,
          createdById: "user-1",
          createdAt: new Date("2026-08-01T08:00:00.000Z"),
          creator: { name: "Owner" },
          _count: { members: 1 },
        },
      },
      {
        role: "TEACHER",
        classroom: {
          id: "joined",
          name: "Joined classroom",
          description: null,
          code: "JOIN12",
          subject: null,
          createdById: "another-user",
          createdAt: new Date("2026-08-02T08:00:00.000Z"),
          creator: { name: "Another owner" },
          _count: { members: 2 },
        },
      },
    ] as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([
      expect.objectContaining({ id: "owned", isOwner: true }),
      expect.objectContaining({ id: "joined", isOwner: false }),
    ]);
  });

  it("marks a newly created classroom as owned", async () => {
    vi.mocked(prisma.classroom.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classroom.create).mockResolvedValue({
      id: "created",
      name: "New classroom",
      description: null,
      code: "NEW123",
      subject: null,
      createdAt: new Date("2026-08-03T08:00:00.000Z"),
      _count: { members: 1 },
    } as never);

    const response = await POST(new NextRequest("http://localhost/api/classrooms", {
      method: "POST",
      body: JSON.stringify({ name: "New classroom" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({ id: "created", isOwner: true });
  });
});
