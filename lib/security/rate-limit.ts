import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

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
  retries = 2,
): Promise<RateLimitResult> {
  const key = bucketKey(scope, subject);
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

      if (!existing || existing.expiresAt <= now) {
        await tx.rateLimitBucket.upsert({
          where: { key },
          create: { key, count: 1, windowStart: now, expiresAt },
          update: { count: 1, windowStart: now, expiresAt },
        });
        return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000));
      if (existing.count >= limit) {
        return { allowed: false, limit, remaining: 0, retryAfterSeconds };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { key },
        data: { count: { increment: 1 } },
        select: { count: true },
      });
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - updated.count),
        retryAfterSeconds: 0,
      };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    const retryable = typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
    if (retryable && retries > 0) {
      return consumeRateLimit(scope, subject, { limit, windowMs }, now, retries - 1);
    }
    throw error;
  }
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
