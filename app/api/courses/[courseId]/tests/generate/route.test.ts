import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma, getCurrentUserId } from '@/lib/db';
import { generateObject } from 'ai';
import { NextRequest } from 'next/server';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    course: {
      findUnique: vi.fn(),
    },
    report: {
        create: vi.fn(),
    }
  },
  getCurrentUserId: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/deepseek', () => ({
  deepseek: vi.fn(),
}));

vi.mock('@/lib/ai/moderation', () => ({
  checkContentSafety: vi.fn(),
  flagContent: vi.fn(),
}));

describe('POST /api/courses/[courseId]/tests/generate', () => {
  const courseId = 'course-1';
  const userId = 'user-1';
  const mockContext = { params: Promise.resolve({ courseId }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (getCurrentUserId as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/courses/course-1/tests/generate', { method: 'POST' });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user does not own the course', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.course.findUnique as any).mockResolvedValue({
      id: courseId,
      createdById: 'different-user',
    });

    const req = new NextRequest('http://localhost/api/courses/course-1/tests/generate', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Test' }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should return 400 if course has no content', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.course.findUnique as any).mockResolvedValue({
      id: courseId,
      createdById: userId,
      modules: [],
    });

    const req = new NextRequest('http://localhost/api/courses/course-1/tests/generate', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Test' }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('no content');
  });

  it('should generate a test and return it if everything is valid', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.course.findUnique as any).mockResolvedValue({
      id: courseId,
      createdById: userId,
      title: 'Course Title',
      modules: [
        {
          lessons: [{ title: 'Lesson 1', content: 'Some content' }],
        },
      ],
    });

    const mockGeneratedTest = {
      title: 'Generated Quiz',
      description: 'Test description',
      questions: [{ text: 'Question 1', type: 'MULTIPLE_CHOICE', points: 1 }],
    };

    (generateObject as any).mockResolvedValue({ object: mockGeneratedTest });
    const { checkContentSafety } = await import('@/lib/ai/moderation');
    (checkContentSafety as any).mockResolvedValue({ safe: true });

    const req = new NextRequest('http://localhost/api/courses/course-1/tests/generate', {
      method: 'POST',
      body: JSON.stringify({ title: 'Generated Quiz' }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.test).toEqual(mockGeneratedTest);
    expect(generateObject).toHaveBeenCalled();
  });

  it('should return 400 and flag content if AI generates unsafe test', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.course.findUnique as any).mockResolvedValue({
      id: courseId,
      createdById: userId,
      modules: [{ lessons: [{ title: 'L1', content: 'C1' }] }],
    });

    (generateObject as any).mockResolvedValue({ object: { title: 'Bad Test' } });
    const { checkContentSafety, flagContent } = await import('@/lib/ai/moderation');
    (checkContentSafety as any).mockResolvedValue({ safe: false, reason: 'Inappropriate' });

    const req = new NextRequest('http://localhost/api/courses/course-1/tests/generate', {
      method: 'POST',
      body: JSON.stringify({ title: 'Bad Test' }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('inappropriate content');
    expect(flagContent).toHaveBeenCalledWith(userId, courseId, 'AI_TEST_GENERATION_UNSAFE', 'Inappropriate');
  });
});
