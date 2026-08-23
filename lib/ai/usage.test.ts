import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiDailyLimitError, getAiUsage, reserveAiAttempt } from "./usage";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    aiUsageQuota: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const now = new Date("2026-08-15T14:00:00.000Z");
const periodStart = new Date("2026-08-15T00:00:00.000Z");

describe("AI usage quotas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically reserves an available attempt", async () => {
    vi.mocked(prisma.aiUsageQuota.updateMany)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    vi.mocked(prisma.aiUsageQuota.findUniqueOrThrow).mockResolvedValue({ attempts: 2 } as never);

    const usage = await reserveAiAttempt("user-1", "SYLLABUS", now);

    expect(usage).toMatchObject({ used: 2, remaining: 1, limit: 3 });
    expect(prisma.aiUsageQuota.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attempts: { lt: 3 } }),
      data: { attempts: { increment: 1 } },
    }));
  });

  it("rejects a fourth attempt", async () => {
    vi.mocked(prisma.aiUsageQuota.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.aiUsageQuota.findUnique).mockResolvedValue({ periodStart, attempts: 3 } as never);

    await expect(reserveAiAttempt("user-1", "LESSON_CONTENT", now)).rejects.toBeInstanceOf(AiDailyLimitError);
  });

  it("creates the first category record without sharing attempts", async () => {
    vi.mocked(prisma.aiUsageQuota.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.aiUsageQuota.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.aiUsageQuota.create).mockResolvedValue({ attempts: 1 } as never);

    const usage = await reserveAiAttempt("user-1", "TEST_EXAM", now);

    expect(usage).toMatchObject({ category: "TEST_EXAM", used: 1, remaining: 2 });
    expect(prisma.aiUsageQuota.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ category: "TEST_EXAM", attempts: 1 }),
    }));
  });

  it("reserves grading from its separate 35-student allowance", async () => {
    vi.mocked(prisma.aiUsageQuota.updateMany)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    vi.mocked(prisma.aiUsageQuota.findUniqueOrThrow).mockResolvedValue({ attempts: 32 } as never);

    const usage = await reserveAiAttempt("teacher-1", "GRADING", now);

    expect(usage).toMatchObject({ category: "GRADING", used: 32, remaining: 3, limit: 35 });
    expect(prisma.aiUsageQuota.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ attempts: { lt: 35 } }),
    }));
  });

  it("reports stale periods as reset while preserving independent categories", async () => {
    vi.mocked(prisma.aiUsageQuota.findMany).mockResolvedValue([
      { category: "LESSON_CONTENT", periodStart, attempts: 2 },
      { category: "SYLLABUS", periodStart: new Date("2026-08-14T00:00:00.000Z"), attempts: 3 },
      { category: "TEST_EXAM", periodStart, attempts: 1 },
      { category: "GRADING", periodStart, attempts: 32 },
    ] as never);

    const snapshot = await getAiUsage("user-1", now);

    expect(snapshot.categories.LESSON_CONTENT.remaining).toBe(1);
    expect(snapshot.categories.SYLLABUS.remaining).toBe(3);
    expect(snapshot.categories.TEST_EXAM.remaining).toBe(2);
    expect(snapshot.categories.GRADING.remaining).toBe(3);
    expect(snapshot.resetsAt).toBe("2026-08-16T00:00:00.000Z");
  });
});
