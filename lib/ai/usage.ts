import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  AI_DAILY_LIMIT,
  AI_USAGE_CATEGORIES,
  AI_USAGE_HEADER_CATEGORY,
  AI_USAGE_HEADER_LIMIT,
  AI_USAGE_HEADER_REMAINING,
  AI_USAGE_HEADER_RESET,
  type AiUsageCategory,
  type AiUsageResponse,
  type AiUsageState,
} from "./usage-shared";

function utcPeriod(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const resetsAt = new Date(periodStart);
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
  return { periodStart, resetsAt };
}

function stateFor(category: AiUsageCategory, attempts: number, resetsAt: Date): AiUsageState {
  const used = Math.min(AI_DAILY_LIMIT, Math.max(0, attempts));
  return {
    category,
    used,
    remaining: AI_DAILY_LIMIT - used,
    limit: AI_DAILY_LIMIT,
    resetsAt: resetsAt.toISOString(),
  };
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class AiDailyLimitError extends Error {
  constructor(public readonly usage: AiUsageState) {
    super("Daily AI limit reached");
    this.name = "AiDailyLimitError";
  }
}

export async function reserveAiAttempt(
  userId: string,
  category: AiUsageCategory,
  now = new Date(),
  retry = true,
): Promise<AiUsageState> {
  const { periodStart, resetsAt } = utcPeriod(now);

  await prisma.aiUsageQuota.updateMany({
    where: { userId, category, periodStart: { lt: periodStart } },
    data: { periodStart, attempts: 0 },
  });

  const incremented = await prisma.aiUsageQuota.updateMany({
    where: { userId, category, periodStart, attempts: { lt: AI_DAILY_LIMIT } },
    data: { attempts: { increment: 1 } },
  });

  if (incremented.count === 0) {
    const existing = await prisma.aiUsageQuota.findUnique({
      where: { userId_category: { userId, category } },
      select: { periodStart: true, attempts: true },
    });

    if (!existing) {
      try {
        const created = await prisma.aiUsageQuota.create({
          data: { userId, category, periodStart, attempts: 1 },
          select: { attempts: true },
        });
        return stateFor(category, created.attempts, resetsAt);
      } catch (error) {
        if (retry && isUniqueConflict(error)) return reserveAiAttempt(userId, category, now, false);
        throw error;
      }
    }

    const isCurrentPeriod = existing.periodStart.getTime() === periodStart.getTime();
    if (isCurrentPeriod && existing.attempts >= AI_DAILY_LIMIT) {
      throw new AiDailyLimitError(stateFor(category, existing.attempts, resetsAt));
    }

    if (retry) return reserveAiAttempt(userId, category, now, false);
    throw new Error("AI usage could not be reserved");
  }

  const current = await prisma.aiUsageQuota.findUniqueOrThrow({
    where: { userId_category: { userId, category } },
    select: { attempts: true },
  });
  return stateFor(category, current.attempts, resetsAt);
}

export async function getAiUsage(userId: string, now = new Date()): Promise<AiUsageResponse> {
  const { periodStart, resetsAt } = utcPeriod(now);
  const records = await prisma.aiUsageQuota.findMany({
    where: { userId },
    select: { category: true, periodStart: true, attempts: true },
  }) as Array<{ category: AiUsageCategory; periodStart: Date; attempts: number }>;
  const byCategory = new Map(records.map((record) => [record.category, record]));
  const categories = Object.fromEntries(AI_USAGE_CATEGORIES.map((category) => {
    const record = byCategory.get(category);
    const attempts = record?.periodStart.getTime() === periodStart.getTime() ? record.attempts : 0;
    return [category, stateFor(category, attempts, resetsAt)];
  })) as Record<AiUsageCategory, AiUsageState>;

  return { categories, resetsAt: resetsAt.toISOString() };
}

export function aiUsageHeaders(usage: AiUsageState) {
  return {
    [AI_USAGE_HEADER_CATEGORY]: usage.category,
    [AI_USAGE_HEADER_LIMIT]: String(usage.limit),
    [AI_USAGE_HEADER_REMAINING]: String(usage.remaining),
    [AI_USAGE_HEADER_RESET]: usage.resetsAt,
  };
}

export function applyAiUsageHeaders(headers: Headers, usage: AiUsageState | null) {
  if (!usage) return headers;
  for (const [name, value] of Object.entries(aiUsageHeaders(usage))) headers.set(name, value);
  return headers;
}

export function withAiUsage<T extends Response>(response: T, usage: AiUsageState | null) {
  applyAiUsageHeaders(response.headers, usage);
  return response;
}

export function aiLimitResponse(error: AiDailyLimitError) {
  const retryAfter = Math.max(1, Math.ceil((new Date(error.usage.resetsAt).getTime() - Date.now()) / 1000));
  return NextResponse.json({
    error: "You have used all 3 AI attempts for this feature today.",
    code: "AI_DAILY_LIMIT_REACHED",
    ...error.usage,
  }, {
    status: 429,
    headers: { ...aiUsageHeaders(error.usage), "Retry-After": String(retryAfter) },
  });
}
