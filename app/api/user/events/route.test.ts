import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH, POST, PUT } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { notifyClassroomMembers } from "@/lib/notifications";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    event: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    reminder: { deleteMany: vi.fn(), updateMany: vi.fn() },
    test: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/notifications", () => ({ notifyClassroomMembers: vi.fn() }));

describe("GET /api/user/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.event.count).mockResolvedValue(0);
    vi.mocked(prisma.reminder.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (operations: unknown) => Promise.all(operations as Promise<unknown>[]) as never);
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
      classroom: { id: "classroom-1", name: "Matematika", members: [{ role: "STUDENT" }] },
    }] as never);

    const response = await GET(new NextRequest("http://localhost/api/user/events?from=2026-08-01&to=2026-08-31"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0]).toMatchObject({ source: "classroom", classroomName: "Matematika", canEdit: false });
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { startDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
          expect.objectContaining({ recurrencePattern: { not: null } }),
        ]),
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { assignmentId: null, testId: null },
              { assignment: { is: { posts: { some: {} } } } },
              { test: { is: { posts: { some: {} } } } },
            ]),
          }),
        ]),
      }),
    }));
  });

  it("keeps the existing month query available", async () => {
    const response = await GET(new NextRequest("http://localhost/api/user/events?month=2026-08"));
    expect(response.status).toBe(200);
    expect(prisma.event.findMany).toHaveBeenCalledOnce();
  });

  it("expands a recurring event inside the requested calendar range", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([{
      id: "event-1", title: "Practice", userId: "user-1", classroomId: null,
      startDate: new Date("2026-08-03T00:00:00.000Z"), endDate: new Date("2026-08-03T00:00:00.000Z"),
      startTime: "09:00", isAllDay: false, recurrencePattern: "WEEKLY", classroom: null, reminders: [],
    }] as never);

    const response = await GET(new NextRequest("http://localhost/api/user/events?from=2026-08-10&to=2026-08-24"));
    const body = await response.json();
    expect(body.map((item: { id: string }) => item.id)).toEqual([
      "event-1::2026-08-10", "event-1::2026-08-17", "event-1::2026-08-24",
    ]);
    expect(body[0]).toMatchObject({ seriesId: "event-1", recurrencePattern: "WEEKLY" });
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

  it("loads one accessible event and serializes a personal reminder", async () => {
    vi.mocked(prisma.event.findFirst).mockResolvedValue({
      id: "event-1", title: "Study", userId: "user-1", classroomId: null,
      startDate: new Date("2026-08-20T00:00:00Z"), startTime: null, isAllDay: true, classroom: null,
      reminders: [{ notifyAt: new Date("2026-08-19T12:00:00Z"), notificationProcessedAt: null }],
    } as never);

    const response = await GET(new NextRequest("http://localhost/api/user/events?id=event-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ source: "personal", canEdit: true, classroom: null });
    expect(body.reminder.notifyAt).toBe("2026-08-19T12:00:00.000Z");
  });

  it("returns 404 for an inaccessible event and rejects oversized ranges", async () => {
    expect((await GET(new NextRequest("http://localhost/api/user/events?id=missing"))).status).toBe(404);
    expect((await GET(new NextRequest("http://localhost/api/user/events?from=2026-01-01&to=2026-08-01"))).status).toBe(400);
  });

  it("filters elapsed events from an upcoming response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 12, 0));
    const base = { userId: "user-1", classroomId: null, startDate: new Date(2026, 7, 20), classroom: null, reminders: [] };
    vi.mocked(prisma.event.findMany).mockResolvedValue([
      { ...base, id: "past", title: "Past", startTime: "11:00", isAllDay: false },
      { ...base, id: "all-day", title: "All day", startTime: null, isAllDay: true },
      { ...base, id: "future", title: "Future", startTime: "13:00", isAllDay: false },
    ] as never);

    const body = await (await GET(new NextRequest("http://localhost/api/user/events?upcoming=2"))).json();
    expect(body.map((event: { id: string }) => event.id)).toEqual(["all-day", "future"]);
  });
});

describe("event mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.event.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.reminder.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (operations: unknown) => Promise.all(operations as Promise<unknown>[]) as never);
  });

  it("validates and creates personal events in the next order", async () => {
    const invalid = await POST(new Request("http://localhost/api/user/events", { method: "POST", body: JSON.stringify({}) }));
    expect(invalid.status).toBe(400);

    vi.mocked(prisma.event.findFirst).mockResolvedValue({ order: 3 } as never);
    vi.mocked(prisma.event.create).mockResolvedValue({ id: "event-2", title: "Review" } as never);
    const response = await POST(new Request("http://localhost/api/user/events", {
      method: "POST",
      body: JSON.stringify({ title: "Review", startDate: "2026-08-21", description: "", isAllDay: true }),
    }));

    expect(response.status).toBe(201);
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user-1", order: 4, description: null, isAllDay: true }) });
  });

  it("validates recurrence and persists it on personal events", async () => {
    const invalid = await POST(new Request("http://localhost/api/user/events", {
      method: "POST", body: JSON.stringify({ title: "Review", startDate: "2026-08-21", recurrencePattern: "YEARLY" }),
    }));
    expect(invalid.status).toBe(400);

    vi.mocked(prisma.event.create).mockResolvedValue({
      id: "event-2", title: "Review", userId: "user-1", classroomId: null,
      startDate: new Date("2026-08-21"), endDate: new Date("2026-08-21"), isAllDay: true, recurrencePattern: "DAILY",
    } as never);
    const response = await POST(new Request("http://localhost/api/user/events", {
      method: "POST", body: JSON.stringify({ title: "Review", startDate: "2026-08-21", isAllDay: true, recurrencePattern: "DAILY" }),
    }));
    expect(response.status).toBe(201);
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ recurrencePattern: "DAILY" }) });
  });

  it("enforces authentication for every mutation", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await DELETE(new NextRequest("http://localhost?id=e"))).status).toBe(401);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }))).status).toBe(401);
    expect((await PUT(new NextRequest("http://localhost", { method: "PUT", body: "[]" }))).status).toBe(401);
  });

  it("rejects missing, inaccessible, and protected assignment deletes", async () => {
    expect((await DELETE(new NextRequest("http://localhost"))).status).toBe(400);
    expect((await DELETE(new NextRequest("http://localhost?id=missing"))).status).toBe(404);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      userId: "user-1", isProtected: true, assignmentId: "assignment-1", classroom: null,
    } as never);
    expect((await DELETE(new NextRequest("http://localhost?id=event-1"))).status).toBe(409);
  });

  it("deletes ordinary events", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ userId: "user-1", isProtected: false, classroom: null } as never);
    vi.mocked(prisma.event.delete).mockResolvedValue({ id: "event-1" } as never);
    const response = await DELETE(new NextRequest("http://localhost?id=event-1"));
    expect(response.status).toBe(200);
    expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
  });

  it("unschedules a protected test transactionally and notifies the classroom", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "event-1", title: "Exam", userId: null, isProtected: true, assignmentId: null,
      testId: "test-1", classroomId: "class-1", classroom: { members: [{ role: "TEACHER" }] }, reminders: [],
    } as never);
    vi.mocked(prisma.event.delete).mockResolvedValue({ id: "event-1" } as never);
    vi.mocked(prisma.test.update).mockResolvedValue({ id: "test-1" } as never);

    expect((await DELETE(new NextRequest("http://localhost?id=event-1"))).status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(notifyClassroomMembers).toHaveBeenCalledWith(expect.objectContaining({ title: "Test date removed", relatedId: "test-1" }));
  });

  it("updates an ordinary event and synchronizes reminders", async () => {
    const original = {
      id: "event-1", title: "Old", userId: "user-1", classroomId: null,
      startDate: new Date("2026-08-20T00:00:00Z"), endDate: new Date("2026-08-20T00:00:00Z"),
      startTime: "09:00", endTime: "10:00", isAllDay: false, isProtected: false, classroom: null, reminders: [],
    };
    vi.mocked(prisma.event.findUnique).mockResolvedValue(original as never);
    vi.mocked(prisma.event.update).mockResolvedValue({ ...original, title: "New", order: 2 } as never);

    const response = await PATCH(new NextRequest("http://localhost", {
      method: "PATCH", body: JSON.stringify({ id: "event-1", title: "New", description: "", order: "2", color: "" }),
    }));
    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: "event-1" }, data: { title: "New", description: null, color: null, order: 2 } });
    expect(prisma.reminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ task: "New" }) }));
  });

  it("rejects invalid patches before writing", async () => {
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: "{}" }))).status).toBe(400);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ id: "missing" }) }))).status).toBe(404);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ userId: "user-1", isProtected: true, assignmentId: "a", classroom: null } as never);
    expect((await PATCH(new NextRequest("http://localhost", { method: "PATCH", body: JSON.stringify({ id: "event-1" }) }))).status).toBe(409);
  });

  it("validates ownership before reordering and updates owned events", async () => {
    expect((await PUT(new NextRequest("http://localhost", { method: "PUT", body: "{}" }))).status).toBe(400);
    vi.mocked(prisma.event.count).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const body = [{ id: "event-1", order: 0 }, { id: "event-2", order: 1 }];
    expect((await PUT(new NextRequest("http://localhost", { method: "PUT", body: JSON.stringify(body) }))).status).toBe(403);

    vi.mocked(prisma.event.update).mockResolvedValue({} as never);
    const response = await PUT(new NextRequest("http://localhost", { method: "PUT", body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect(prisma.event.update).toHaveBeenCalledTimes(2);
  });
});
