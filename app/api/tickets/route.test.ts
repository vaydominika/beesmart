import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { claimUploads } from "@/lib/files/lifecycle";

const tx = {
  report: { create: vi.fn() },
  notification: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { $transaction: vi.fn() },
}));
vi.mock("@/lib/files/lifecycle", () => ({
  claimUploads: vi.fn(),
  UploadClaimError: class UploadClaimError extends Error {},
}));

const request = (body: unknown) => new Request("http://localhost/api/tickets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_EARLY_ACCESS_FEEDBACK_ENABLED", "true");
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(claimUploads).mockResolvedValue([{ id: "file-1" }] as never);
    tx.report.create.mockResolvedValue({ id: "ticket-1", type: "EARLY_ACCESS_FEEDBACK" });
    tx.notification.create.mockResolvedValue({});
    // Prisma's overloaded transaction signature cannot preserve the lightweight test client type.
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("hides the endpoint when Early Access is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_EARLY_ACCESS_FEEDBACK_ENABLED", "false");
    expect((await POST(request({ description: "Bug" }))).status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("claims screenshots and creates a receipt notification", async () => {
    const response = await POST(request({ description: "The timer stops.", uploadIds: ["file-1"] }));
    expect(response.status).toBe(201);
    expect(claimUploads).toHaveBeenCalledWith(tx, ["file-1"], "user-1", "TICKET_ATTACHMENT");
    expect(tx.report.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "user-1",
      type: "EARLY_ACCESS_FEEDBACK",
      attachments: { create: [{ storedFileId: "file-1" }] },
    }) });
    expect(tx.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      relatedId: "ticket-1",
      actionUrl: "/tickets#ticket-1",
    }) });
  });

  it("limits a ticket to five images", async () => {
    const response = await POST(request({ description: "Bug", uploadIds: ["1", "2", "3", "4", "5", "6"] }));
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
