import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTicketsClient, type AdminTicketItem } from "./AdminTicketsClient";

const tickets: AdminTicketItem[] = [
  {
    id: "report-ticket-0001",
    type: "COURSE_REPORT",
    status: "OPEN",
    reason: "Course material is inaccurate",
    description: "The second lesson contains an outdated answer.",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    reviewedAt: null,
    reporter: { id: "user-1", name: "Learner One", email: "learner@example.com" },
    reviewer: null,
    course: { id: "course-1", title: "Biology basics" },
    attachments: [],
  },
  {
    id: "feedback-ticket-0001",
    type: "EARLY_ACCESS_FEEDBACK",
    status: "IN_PROGRESS",
    reason: "Please add keyboard shortcuts",
    description: "Navigation would be faster with shortcuts.",
    createdAt: "2026-08-20T11:00:00.000Z",
    updatedAt: "2026-08-20T11:00:00.000Z",
    reviewedAt: null,
    reporter: { id: "user-2", name: "Learner Two", email: "learner2@example.com" },
    reviewer: null,
    course: null,
    attachments: [],
  },
];

describe("AdminTicketsClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  });

  it("keeps course reports and feedback in separate queues", () => {
    render(<AdminTicketsClient initialTickets={tickets} currentAdmin={{ name: "Ada", email: "admin@example.com" }} />);

    expect(screen.getByRole("heading", { name: "Course material is inaccurate" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Please add keyboard shortcuts" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Feedback, 1 submission" }));

    expect(screen.getByRole("heading", { name: "Please add keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Course material is inaccurate" })).not.toBeInTheDocument();
  });

  it("switches between persisted monochrome light and dark modes", () => {
    const { container } = render(<AdminTicketsClient initialTickets={tickets} currentAdmin={{ name: "Ada", email: "admin@example.com" }} />);

    const adminPage = container.querySelector("[data-admin-theme]");
    expect(adminPage).toHaveAttribute("data-admin-theme", "light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(adminPage).toHaveAttribute("data-admin-theme", "dark");
    expect(window.localStorage.getItem("beesmart-admin-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });
});
