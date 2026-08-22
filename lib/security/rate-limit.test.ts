import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, requestClientAddress } from "./rate-limit";
import { prisma } from "@/lib/db";

const bucket = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    rateLimitBucket: { deleteMany: vi.fn() },
  },
}));

describe("database-backed rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: { rateLimitBucket: typeof bucket }) => Promise<unknown>) => callback({ rateLimitBucket: bucket })) as never);
  });

  it("creates the first request bucket", async () => {
    bucket.findUnique.mockResolvedValue(null);
    bucket.upsert.mockResolvedValue({});
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 2 });
  });

  it("blocks requests after the limit", async () => {
    bucket.findUnique.mockResolvedValue({ count: 3, expiresAt: new Date(Date.now() + 60_000) });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: false, remaining: 0 });
    expect(bucket.update).not.toHaveBeenCalled();
  });

  it("increments an active bucket", async () => {
    bucket.findUnique.mockResolvedValue({ count: 1, expiresAt: new Date(Date.now() + 60_000) });
    bucket.update.mockResolvedValue({ count: 2 });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 1 });
  });

  it("prefers the trusted real-IP header and safely falls back", () => {
    expect(requestClientAddress(new Headers({ "x-real-ip": "203.0.113.1", "x-forwarded-for": "198.51.100.2" }))).toBe("203.0.113.1");
    expect(requestClientAddress(new Headers())).toBe("unknown");
  });
});
