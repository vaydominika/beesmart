import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma, getCurrentUserId } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    classroom: {
      findUnique: vi.fn(),
    },
    classroomMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    classroomInvitation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    courseAccess: { createMany: vi.fn() },
  },
  getCurrentUserId: vi.fn(),
}));

describe('POST /api/classrooms/join', () => {
  const userId = 'user-1';
  const classroomId = 'class-1';
  const classroomCode = 'MATH101';

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue({ email: 'student@example.com' });
    (prisma.classroomInvitation.findFirst as any).mockResolvedValue(null);
  });

  it('should return 401 if user is not authenticated', async () => {
    (getCurrentUserId as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/classrooms/join', { method: 'POST' });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if code is missing', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    const req = new NextRequest('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: '' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Code is required');
  });

  it('should return 404 if classroom is not found', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroom.findUnique as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: 'INVALID' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Classroom not found');
  });

  it('should return 409 if user is already a member', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroom.findUnique as any).mockResolvedValue({ id: classroomId, code: classroomCode });
    (prisma.classroomMember.findUnique as any).mockResolvedValue({ id: 'm1' });

    const req = new NextRequest('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: classroomCode }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('Already a member');
  });

  it('should successfully join a classroom', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroom.findUnique as any).mockResolvedValue({
      id: classroomId,
      code: classroomCode,
      name: 'Class Name',
      _count: { members: 5 },
      courseLinks: [],
    });
    (prisma.classroomMember.findUnique as any).mockResolvedValue(null);
    (prisma.classroomMember.create as any).mockResolvedValue({ id: 'm-new' });

    const req = new NextRequest('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: classroomCode }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(classroomId);
    expect(prisma.classroomMember.create).toHaveBeenCalledWith({
      data: {
        userId,
        classroomId,
        role: 'STUDENT',
      },
    });
  });

  it('uses the role from a pending invitation', async () => {
    (getCurrentUserId as any).mockResolvedValue(userId);
    (prisma.classroom.findUnique as any).mockResolvedValue({
      id: classroomId,
      code: classroomCode,
      name: 'Class Name',
      _count: { members: 5 },
      courseLinks: [],
    });
    (prisma.classroomMember.findUnique as any).mockResolvedValue(null);
    (prisma.classroomInvitation.findFirst as any).mockResolvedValue({ id: 'invite-1', role: 'TEACHER' });

    const req = new NextRequest('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: classroomCode }),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(prisma.classroomMember.create).toHaveBeenCalledWith({
      data: { userId, classroomId, role: 'TEACHER' },
    });
    expect(prisma.classroomInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: { acceptedAt: expect.any(Date) },
    });
  });
});
