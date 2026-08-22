import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    event: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({ notifyClassroomMembers: vi.fn() }));

describe("GET /api/user/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/user/events?from=2026-08-01&to=2026-08-31"));
    expect(response.status).toBe(401);
  });

  it("rejects incomplete or invalid ranges", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/events?from=2026-08-01"));
    expect(response.status).toBe(400);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("queries the inclusive range and serializes event sources", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([{
      id: "event-1",
      title: "Class test",
      startDate: new Date(2026, 7, 5),
      endDate: new Date(2026, 7, 5),
      startTime: "09:00",
      endTime: "10:00",
      isAllDay: false,
      userId: null,
      classroomId: "classroom-1",
      courseId: null,
      classroom: { id: "classroom-1", name: "Matematika", members: [{ role: "STUDENT" }] },
    }] as never);

    const response = await GET(new NextRequest("http://localhost/api/user/events?from=2026-08-01&to=2026-08-31"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0]).toMatchObject({ source: "classroom", classroomName: "Matematika", canEdit: false });
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        startDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
      }),
    }));
  });

  it("keeps the existing month query available", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/events?month=2026-08"));
    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledOnce();
  });

  it("rejects invalid months and unbounded upcoming limits", async () => {
    expect((await GET(new NextRequest("http://localhost/api/user/events?month=2026-13"))).status).toBe(400);
    expect((await GET(new NextRequest("http://localhost/api/user/events?upcoming=5000"))).status).toBe(400);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("bounds the legacy unfiltered response", async () => {
    expect((await GET(new NextRequest("http://localhost/api/user/events"))).status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });
});
