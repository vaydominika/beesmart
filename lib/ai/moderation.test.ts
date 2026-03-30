import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkContentSafety, flagContent } from './moderation';
import { generateObject } from 'ai';
import { prisma } from '@/lib/db';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/deepseek', () => ({
  deepseek: vi.fn(),
}));

// Mock the prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    report: {
      create: vi.fn(),
    },
  },
}));

describe('Moderation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkContentSafety', () => {
    it('should return safe: true for clean content', async () => {
      (generateObject as any).mockResolvedValue({
        object: { safe: true, flaggedCategories: [] },
      });

      const result = await checkContentSafety('This is a great lesson about bees!');

      expect(result.safe).toBe(true);
      expect(generateObject).toHaveBeenCalled();
    });

    it('should return safe: false for inappropriate content', async () => {
      (generateObject as any).mockResolvedValue({
        object: { 
          safe: false, 
          reason: 'Profanity detected', 
          flaggedCategories: ['Profanity'] 
        },
      });

      const result = await checkContentSafety('Some bad words here');

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Profanity detected');
    });

    it('should default to safe: true if the AI check fails', async () => {
      (generateObject as any).mockRejectedValue(new Error('API Down'));

      const result = await checkContentSafety('Any content');

      expect(result.safe).toBe(true);
    });
  });

  describe('flagContent', () => {
    it('should create a report in the database', async () => {
      const mockReport = { id: 'report-1' };
      (prisma.report.create as any).mockResolvedValue(mockReport);

      await flagContent('user-1', 'course-1', 'Test Reason', 'Some details');

      expect(prisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          courseId: 'course-1',
          reason: 'AI_FLAG: Test Reason',
          status: 'PENDING',
        }),
      });
    });
  });
});
