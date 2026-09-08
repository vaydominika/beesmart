import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserStreak } from './streak';
import { prisma } from './db';

// Mock the prisma client manually here to avoid circular imports in global setup
vi.mock('./db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('updateUserStreak', () => {
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null if the user no longer exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await updateUserStreak(userId);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastActivityDate: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should increment streak if last activity was yesterday', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    (prisma.user.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: yesterday,
    });

    (prisma.user.update as any).mockResolvedValue({
      userId,
      currentStreak: 6,
      longestStreak: 10,
      lastActivityDate: new Date(),
    });

    const result = await updateUserStreak(userId);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({
        currentStreak: 6,
        longestStreak: 10,
      }),
    });
    expect(result?.currentStreak).toBe(6);
  });

  it('should reset streak to 1 if last activity was before yesterday', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getUTCDate() - 3);

    (prisma.user.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: threeDaysAgo,
    });

    (prisma.user.update as any).mockResolvedValue({
      userId,
      currentStreak: 1,
      longestStreak: 10,
      lastActivityDate: new Date(),
    });

    const result = await updateUserStreak(userId);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({
        currentStreak: 1,
      }),
    });
    expect(result?.currentStreak).toBe(1);
  });

  it('should do nothing if already active today', async () => {
    const today = new Date();

    (prisma.user.findUnique as any).mockResolvedValue({
      userId,
      currentStreak: 5,
      longestStreak: 10,
      lastActivityDate: today,
    });

    const result = await updateUserStreak(userId);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result?.currentStreak).toBe(5);
  });
});
