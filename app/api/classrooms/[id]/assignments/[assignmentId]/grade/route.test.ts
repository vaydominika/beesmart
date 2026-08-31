import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma, getCurrentUserId } from '@/lib/db';
import { NextRequest } from 'next/server';
import { routeContext } from '@/test-utils/route-context';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    classroomMember: {
      findUnique: vi.fn(),
    },
    submission: {
      updateMany: vi.fn(),
    },
    grade: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    assignedWork: {
      findFirst: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
  getCurrentUserId: vi.fn(),
}));

describe('POST /api/classrooms/[id]/assignments/[assignmentId]/grade', () => {
  const classroomId = 'class-1';
  const assignmentId = 'assign-1';
  const userId = 'teacher-1';
  const studentId = 'student-1';
  const mockContext = routeContext({ id: classroomId, assignmentId });

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.assignedWork.findFirst as any).mockResolvedValue({ title: 'Math Quiz', isGraded: true, maxPoints: 100 });
  });

  it('should return 401 if user is not authenticated', async () => {
    (getCurrentUserId as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/classrooms/c1/assignments/a1/grade', { method: 'POST' });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 if user is not a teacher/TA', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroomMember.findUnique as any).mockResolvedValue({
      role: 'STUDENT',
    });

    const req = new NextRequest('http://localhost/api/classrooms/c1/assignments/a1/grade', {
      method: 'POST',
      body: JSON.stringify({ studentId: 's1', score: 90 }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Only teachers/TAs can grade');
  });

  it('should successfully grade a submission for a teacher', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroomMember.findUnique as any).mockResolvedValue({
      role: 'TEACHER',
    });
    (prisma.grade.findFirst as any).mockResolvedValue(null);
    (prisma.grade.create as any).mockResolvedValue({ id: 'g1', score: 85 });

    const req = new NextRequest('http://localhost/api/classrooms/c1/assignments/a1/grade', {
      method: 'POST',
      body: JSON.stringify({ studentId, score: 85, maxScore: 100, feedback: 'Good job!' }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.score).toBe(85);
    expect(prisma.submission.updateMany).toHaveBeenCalledWith({
      where: { assignedWorkId: assignmentId, userId: studentId },
      data: { status: 'GRADED' },
    });
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should reject grading when the assignment switch is off', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroomMember.findUnique as any).mockResolvedValue({ role: 'TEACHER' });
    (prisma.assignedWork.findFirst as any).mockResolvedValue({ title: 'Practice', isGraded: false, maxPoints: null });

    const response = await POST(new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ studentId, score: 10 }),
    }), mockContext);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'This assignment is not graded' });
    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it('should reject scores above the assignment maximum', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroomMember.findUnique as any).mockResolvedValue({ role: 'TEACHER' });

    const response = await POST(new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ studentId, score: 101 }),
    }), mockContext);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Score must be between 0 and 100' });
    expect(prisma.grade.create).not.toHaveBeenCalled();
  });

  it('should update an existing grade if it already exists', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroomMember.findUnique as any).mockResolvedValue({
      role: 'TEACHER',
    });
    (prisma.grade.findFirst as any).mockResolvedValue({ id: 'existing-g1', score: 70 });
    (prisma.grade.update as any).mockResolvedValue({ id: 'existing-g1', score: 95 });

    const req = new NextRequest('http://localhost/api/classrooms/c1/assignments/a1/grade', {
      method: 'POST',
      body: JSON.stringify({ studentId, score: 95 }),
    });

    const response = await POST(req, mockContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.score).toBe(95);
    expect(prisma.grade.update).toHaveBeenCalled();
    expect(prisma.grade.create).not.toHaveBeenCalled();
  });
});
