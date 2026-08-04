import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { AnnouncementBanner } from './AnnouncementBanner';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import React from 'react';

// Mock simple ID generation
const classroomId = 'test-classroom';

// MSW Server setup
const server = setupServer(
  http.get(`/api/classrooms/${classroomId}/announcements`, () => {
    return HttpResponse.json([
      {
        id: '1',
        title: 'Test Announcement',
        body: 'This is a test body',
        priority: 'URGENT',
        isPinned: false,
        createdAt: new Date().toISOString(),
        author: { id: 'u1', name: 'Teacher' },
      },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AnnouncementBanner', () => {
  const defaultProps = {
    classroomId,
    isTeacher: false,
  };

  it('renders urgent announcements fetched from API', async () => {
    render(<AnnouncementBanner {...defaultProps} />);

    // Wait for the announcement to appear
    await waitFor(() => {
      expect(screen.getByText('Test Announcement')).toBeInTheDocument();
    });
    expect(screen.getByText('This is a test body')).toBeInTheDocument();
  });

  it('shows the "New Announcement" button only for teachers', async () => {
    const { rerender } = render(<AnnouncementBanner {...defaultProps} />);
    expect(screen.queryByText(/New Announcement/i)).not.toBeInTheDocument();

    rerender(<AnnouncementBanner {...defaultProps} isTeacher={true} />);
    expect(screen.getByText(/New Announcement/i)).toBeInTheDocument();
  });

  it('lets teachers cancel an urgent announcement', async () => {
    server.use(
      http.delete(`/api/classrooms/${classroomId}/announcements`, async ({ request }) => {
        const body = await request.json() as { announcementId: string };
        expect(body.announcementId).toBe('1');
        return HttpResponse.json({ success: true });
      })
    );

    render(<AnnouncementBanner {...defaultProps} isTeacher={true} />);
    const cancelButton = await screen.findByRole('button', { name: /Cancel urgent announcement: Test Announcement/i });
    fireEvent.click(cancelButton);
    expect(screen.getByText('Cancel announcement?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel announcement' }));

    await waitFor(() => expect(screen.queryByText('Test Announcement')).not.toBeInTheDocument());
  });

  it('does not show urgent cancellation controls to students', async () => {
    render(<AnnouncementBanner {...defaultProps} />);
    await screen.findByText('Test Announcement');
    expect(screen.queryByRole('button', { name: /Cancel urgent announcement/i })).not.toBeInTheDocument();
  });

  it('does not render non-urgent announcements above the Classroom', async () => {
    server.use(
      http.get(`/api/classrooms/${classroomId}/announcements`, () => HttpResponse.json([{
        id: '2', title: 'Regular update', body: 'Visible in notifications only', priority: 'INFO',
        isPinned: false, createdAt: new Date().toISOString(), author: { id: 'u1', name: 'Teacher' },
      }]))
    );
    render(<AnnouncementBanner {...defaultProps} isTeacher={true} />);
    await waitFor(() => expect(screen.getByText(/New Announcement/i)).toBeInTheDocument());
    expect(screen.queryByText('Regular update')).not.toBeInTheDocument();
  });

  it('renders nothing if no announcements and not a teacher', async () => {
    server.use(
      http.get(`/api/classrooms/${classroomId}/announcements`, () => {
        return HttpResponse.json([]);
      })
    );

    const { container } = render(<AnnouncementBanner {...defaultProps} />);
    
    // Give it a moment to finish the fetch
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
