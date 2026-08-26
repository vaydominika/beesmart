import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupExpiredRateLimits, clearRateLimit, consumeRateLimit, rateLimitHeaders, requestClientAddress } from "./rate-limit";
import { prisma } from "@/lib/db";

const bucket = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    rateLimitBucket: bucket,
  },
}));

describe("database-backed rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the first request bucket", async () => {
    bucket.findUnique.mockResolvedValue(null);
    bucket.create.mockResolvedValue({});
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 2 });
  });

  it("blocks requests after the limit", async () => {
    bucket.findUnique.mockResolvedValue({ count: 3, expiresAt: new Date(Date.now() + 60_000) });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: false, remaining: 0 });
    expect(bucket.updateMany).not.toHaveBeenCalled();
  });

  it("increments an active bucket", async () => {
    bucket.findUnique.mockResolvedValue({ count: 1, expiresAt: new Date(Date.now() + 60_000) });
    bucket.updateMany.mockResolvedValue({ count: 1 });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 60_000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 1 });
  });

  it("prefers the trusted real-IP header and safely falls back", () => {
    expect(requestClientAddress(new Headers({ "x-real-ip": "203.0.113.1", "x-forwarded-for": "198.51.100.2" }))).toBe("203.0.113.1");
    expect(requestClientAddress(new Headers({ "x-forwarded-for": " 198.51.100.2, 203.0.113.1" }))).toBe("198.51.100.2");
    expect(requestClientAddress(new Headers())).toBe("unknown");
  });

  it("resets an expired bucket", async () => {
    const now = new Date("2026-08-26T10:00:00Z");
    bucket.findUnique.mockResolvedValue({ count: 20, expiresAt: new Date("2026-08-26T09:59:59Z") });
    bucket.updateMany.mockResolvedValue({ count: 1 });
    await expect(consumeRateLimit("login", " Person@Example.com ", { limit: 4, windowMs: 60_000 }, now))
      .resolves.toEqual({ allowed: true, limit: 4, remaining: 3, retryAfterSeconds: 0 });
    expect(bucket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ count: 1, windowStart: now }),
    }));
  });

  it("retries a competing bucket creation and then succeeds", async () => {
    bucket.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      count: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    bucket.create.mockRejectedValueOnce({ code: "P2002" });
    bucket.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 2, windowMs: 1000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 0 });
    expect(bucket.findUnique).toHaveBeenCalledTimes(2);
  });

  it("does not hide exhausted creation races or unrelated database errors", async () => {
    bucket.findUnique.mockResolvedValue(null);
    bucket.create.mockRejectedValue({ code: "P2002" });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 2, windowMs: 1000 }, new Date(), 0))
      .rejects.toEqual({ code: "P2002" });
    bucket.create.mockRejectedValue(new Error("offline"));
    await expect(consumeRateLimit("login", "person@example.com", { limit: 2, windowMs: 1000 }))
      .rejects.toThrow("offline");
  });

  it("retries compare-and-set contention and reports exhausted contention", async () => {
    const active = { count: 1, expiresAt: new Date(Date.now() + 60_000) };
    bucket.findUnique.mockResolvedValue(active);
    bucket.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 1000 }))
      .resolves.toMatchObject({ allowed: true, remaining: 1 });

    bucket.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeRateLimit("login", "person@example.com", { limit: 3, windowMs: 1000 }, new Date(), 0))
      .rejects.toThrow("changed too frequently");
  });

  it("serializes standard headers and only includes retry-after when blocked", () => {
    expect(rateLimitHeaders({ allowed: true, limit: 5, remaining: 4, retryAfterSeconds: 0 })).toEqual({
      "RateLimit-Limit": "5", "RateLimit-Remaining": "4",
    });
    expect(rateLimitHeaders({ allowed: false, limit: 5, remaining: 0, retryAfterSeconds: 12 })).toEqual({
      "RateLimit-Limit": "5", "RateLimit-Remaining": "0", "Retry-After": "12",
    });
  });

  it("clears one normalized bucket and cleans expired buckets", async () => {
    vi.mocked(prisma.rateLimitBucket.deleteMany).mockResolvedValue({ count: 1 });
    await clearRateLimit("login", " Person@Example.com ");
    expect(prisma.rateLimitBucket.deleteMany).toHaveBeenCalledWith({ where: { key: expect.stringMatching(/^login:[a-f0-9]{64}$/) } });
    const now = new Date("2026-08-26T10:00:00Z");
    await expect(cleanupExpiredRateLimits(now)).resolves.toEqual({ count: 1 });
    expect(prisma.rateLimitBucket.deleteMany).toHaveBeenLastCalledWith({ where: { expiresAt: { lte: now } } });
  });
});
