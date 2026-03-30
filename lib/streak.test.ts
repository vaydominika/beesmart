import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserStreak } from './streak';
import { prisma } from './db';

// Mock the prisma client manually here to avoid circular imports in global setup
vi.mock('./db', () => ({
  prisma: {
    streak: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('updateUserStreak', () => {
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new streak if none exists', async () => {
    (prisma.streak.findUnique as any).mockResolvedValue(null);
    (prisma.streak.create as any).mockResolvedValue({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
    });

    const result = await updateUserStreak(userId);

    expect(prisma.streak.findUnique).toHaveBeenCalledWith({ where: { userId } });
    expect(prisma.streak.create).toHaveBeenCalled();
    expect(result.currentStreak).toBe(1);
  });

  it('should increment streak if last activity was yesterday', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    (prisma.streak.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: yesterday,
    });

    (prisma.streak.update as any).mockResolvedValue({
      userId,
      currentStreak: 6,
      longestStreak: 10,
      lastActivityDate: new Date(),
    });

    const result = await updateUserStreak(userId);

    expect(prisma.streak.update).toHaveBeenCalledWith({
      where: { userId },
      data: expect.objectContaining({
        currentStreak: 6,
        longestStreak: 10,
      }),
    });
    expect(result.currentStreak).toBe(6);
  });

  it('should reset streak to 1 if last activity was before yesterday', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getUTCDate() - 3);

    (prisma.streak.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: threeDaysAgo,
    });

    (prisma.streak.update as any).mockResolvedValue({
      userId,
      currentStreak: 1,
      longestStreak: 10,
      lastActivityDate: new Date(),
    });

    const result = await updateUserStreak(userId);

    expect(prisma.streak.update).toHaveBeenCalledWith({
      where: { userId },
      data: expect.objectContaining({
        currentStreak: 1,
      }),
    });
    expect(result.currentStreak).toBe(1);
  });

  it('should do nothing if already active today', async () => {
    const today = new Date();

    (prisma.streak.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
    });

    const result = await updateUserStreak(userId);

    expect(prisma.streak.update).not.toHaveBeenCalled();
    expect(result.currentStreak).toBe(5);
  });
});
