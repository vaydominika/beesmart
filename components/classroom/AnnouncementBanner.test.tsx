import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
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
        priority: 'INFO',
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
  const mockSetDismissed = vi.fn();
  const defaultProps = {
    classroomId,
    isTeacher: false,
    dismissed: new Set<string>(),
    setDismissed: mockSetDismissed,
    showDismissed: false,
  };

  it('renders announcements fetched from API', async () => {
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

  it('calls setDismissed when the "Mark as read" button is clicked', async () => {
    render(<AnnouncementBanner {...defaultProps} />);

    await waitFor(() => screen.getByText('Test Announcement'));
    
    // The "Mark as read" button is the one with the Circle icon (not CheckCircle)
    const markAsReadBtn = screen.getByTitle('Mark as read');
    fireEvent.click(markAsReadBtn);

    expect(mockSetDismissed).toHaveBeenCalled();
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
