import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    event: { findFirst: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    reminder: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

const context = { params: Promise.resolve({ id: "event-1" }) };
const event = { id: "event-1", title: "Biology test", startDate: new Date("2099-08-09T00:00:00.000Z"), startTime: "12:00", isAllDay: false };

describe("event reminder API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.event.findFirst).mockResolvedValue(event as never);
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ reminderNotifications: true } as never);
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost"), context);
    expect(response.status).toBe(401);
  });

  it("upserts one personal reminder for an accessible event", async () => {
    vi.mocked(prisma.reminder.upsert).mockResolvedValue({ notifyAt: new Date("2099-08-09T10:00:00.000Z"), notificationProcessedAt: null } as never);
    const response = await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ timeZone: "UTC", notifyAt: "2099-08-09T10:00:00.000Z", eventStartsAt: "2099-08-09T12:00:00.000Z" }) }), context);
    expect(response.status).toBe(200);
    expect(prisma.reminder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_eventId: { userId: "user-1", eventId: "event-1" } },
      create: expect.objectContaining({ eventId: "event-1", task: "Biology test" }),
    }));
  });

  it("removes only the current user's reminder", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context);
    expect(response.status).toBe(200);
    expect(prisma.reminder.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", eventId: "event-1" } });
  });
});
