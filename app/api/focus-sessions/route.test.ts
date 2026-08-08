import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { focusSession: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() } },
}));

describe("/api/focus-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.focusSession.count).mockImplementation(async ({ where }: { where: { type: string } }) => where.type === "ACTIVE" ? 4 : 2);
    vi.mocked(prisma.focusSession.findUnique).mockResolvedValue(null as never);
  });

  it("returns all-time counts for the authenticated user", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ focusCount: 4, breakCount: 2 });
  });

  it("validates and stores a completed phase", async () => {
    vi.mocked(prisma.focusSession.create).mockResolvedValue({ id: "session-1", userId: "user-1" } as never);
    const response = await POST(new Request("http://localhost/api/focus-sessions", { method: "POST", body: JSON.stringify({ completionId: "phase-1", type: "active", durationSeconds: 1500, startedAt: "2026-08-08T08:00:00.000Z", endedAt: "2026-08-08T08:25:00.000Z" }) }));
    expect(response.status).toBe(201);
    expect(prisma.focusSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ completionId: "phase-1", type: "ACTIVE", durationSeconds: 1500, userId: "user-1" }) });
  });

  it("returns an existing completion without duplicating it", async () => {
    vi.mocked(prisma.focusSession.findUnique).mockResolvedValue({ id: "session-1", userId: "user-1" } as never);
    const response = await POST(new Request("http://localhost/api/focus-sessions", { method: "POST", body: JSON.stringify({ completionId: "phase-1", type: "break", durationSeconds: 300, startedAt: "2026-08-08T08:00:00.000Z", endedAt: "2026-08-08T08:05:00.000Z" }) }));
    expect(response.status).toBe(200);
    expect(prisma.focusSession.create).not.toHaveBeenCalled();
  });
});
