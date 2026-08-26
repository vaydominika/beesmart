import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function bucketKey(scope: string, subject: string) {
  return `${scope}:${createHash("sha256").update(subject.trim().toLowerCase()).digest("hex")}`;
}

export function requestClientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}

export async function consumeRateLimit(
  scope: string,
  subject: string,
  { limit, windowMs }: RateLimitOptions,
  now = new Date(),
  retries = 4,
): Promise<RateLimitResult> {
  const key = bucketKey(scope, subject);
  const expiresAt = new Date(now.getTime() + windowMs);
  const existing = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (!existing) {
    try {
      await prisma.rateLimitBucket.create({
        data: { key, count: 1, windowStart: now, expiresAt },
      });
      return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
    } catch (error) {
      const racedWithAnotherRequest =
        typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
      if (!racedWithAnotherRequest || retries <= 0) throw error;
      return consumeRateLimit(scope, subject, { limit, windowMs }, now, retries - 1);
    }
  }

  if (existing.expiresAt <= now) {
    const reset = await prisma.rateLimitBucket.updateMany({
      where: { key, count: existing.count, expiresAt: existing.expiresAt },
      data: { count: 1, windowStart: now, expiresAt },
    });
    if (reset.count === 1) {
      return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
    }
  } else {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000));
    if (existing.count >= limit) {
      return { allowed: false, limit, remaining: 0, retryAfterSeconds };
    }

    const incremented = await prisma.rateLimitBucket.updateMany({
      where: { key, count: existing.count, expiresAt: existing.expiresAt },
      data: { count: { increment: 1 } },
    });
    if (incremented.count === 1) {
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - existing.count - 1),
        retryAfterSeconds: 0,
      };
    }
  }

  if (retries <= 0) throw new Error("Rate-limit bucket changed too frequently");
  return consumeRateLimit(scope, subject, { limit, windowMs }, now, retries - 1);
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    ...(result.retryAfterSeconds > 0 ? { "Retry-After": String(result.retryAfterSeconds) } : {}),
  };
}

export async function clearRateLimit(scope: string, subject: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key: bucketKey(scope, subject) } });
}

export async function cleanupExpiredRateLimits(now = new Date()) {
  return prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lte: now } } });
}
