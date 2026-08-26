import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RightSidebar } from "./RightSidebar";

vi.mock("./LayoutProvider", () => ({ useLayout: () => ({ isRightSidebarOpen: true }) }));
vi.mock("@/components/settings/SettingsProvider", () => ({ useSettings: () => ({ openProfileModal: vi.fn() }) }));
vi.mock("@/lib/DashboardContext", () => ({
  useDashboard: () => ({
    data: {
      user: {
        id: "user-1",
        name: "Ada",
        avatar: "/api/files/avatar-1",
        bannerImageUrl: null,
        role: "Legacy global role",
      },
      activeTicketCount: 2,
    },
  }),
}));
vi.mock("./CalendarWidget", () => ({ CalendarWidget: () => <div>Calendar</div> }));
vi.mock("@/components/dashboard/ReminderItem", () => ({ ReminderItem: ({ task, date, time }: { task: string; date: string; time: string }) => <div><span>{task}</span><span>{date}</span><span data-testid="reminder-time">{time}</span></div> }));
vi.mock("@/components/calendar/EventModal", () => ({ EventModal: () => null }));
vi.mock("@/components/calendar/EventDetailModal", () => ({ EventDetailModal: () => <div>Event details</div> }));
vi.mock("@/components/calendar/ClassroomWorkEditModal", () => ({
  isClassroomWorkEvent: (event: { classroomId?: string | null; assignmentId?: string | null; testId?: string | null }) => Boolean(event.classroomId && (event.assignmentId || event.testId)),
}));
vi.mock("@/hooks/use-event-sync", () => ({ useEventSync: () => ({ triggerUpdate: vi.fn() }) }));
vi.mock("./NotificationCenter", () => ({ NotificationCenter: () => <button type="button">Notifications</button> }));

describe("RightSidebar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  it("shows the account name without displaying a global role", () => {
    const { container } = render(<RightSidebar />);

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Legacy global role")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("rounded-tl-[30px]");
    expect(container.firstElementChild).not.toHaveClass("rounded-bl-[30px]");
  });

  it("keeps notifications in the banner and places settings on the profile avatar", () => {
    render(<RightSidebar variant="overlay" onClose={vi.fn()} />);

    const avatar = screen.getByAltText("Ada");
    const notificationButton = screen.getByRole("button", { name: "Notifications" });
    const settingsButton = screen.getByRole("button", { name: "Profile settings" });
    const closeButton = screen.getByRole("button", { name: "Close sidebar" });

    expect(avatar).toHaveAttribute("src", "/api/files/avatar-1");
    expect(notificationButton.compareDocumentPosition(closeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(avatar.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links a subtle active-ticket count to My Reports", () => {
    render(<RightSidebar />);
    expect(screen.getByRole("link", { name: "Active tickets: 2" })).toHaveAttribute("href", "/tickets");
  });

  it("shows only a classroom assessment due time and opens its preview first", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => Promise.resolve({
      ok: true,
      json: async () => String(input).includes("upcoming=") ? [{
        id: "event-1", title: "Exam: Final", startDate: "2099-08-26T08:00:00.000Z", endDate: "2099-08-26T16:30:00.000Z",
        startTime: "09:00", endTime: "17:30", isAllDay: false, source: "classroom", classroomId: "class-1", testId: "test-1", canEdit: true,
      }] : [],
    })));

    render(<RightSidebar />);

    const reminder = await screen.findByRole("button", { name: /Exam: Final/i });
    expect(screen.getByTestId("reminder-time")).toHaveTextContent("17:30");
    expect(screen.getByTestId("reminder-time")).not.toHaveTextContent("09:00");
    fireEvent.click(reminder);
    expect(screen.getByText("Event details")).toBeInTheDocument();
  });

  it("does not label an assignment without a due hour as all day", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => Promise.resolve({
      ok: true,
      json: async () => String(input).includes("upcoming=") ? [{
        id: "event-2", title: "Assignment: Notes", startDate: "2099-08-26T00:00:00.000Z",
        startTime: null, endTime: null, isAllDay: true, source: "classroom", classroomId: "class-1", assignmentId: "assignment-1", canEdit: true,
      }] : [],
    })));

    render(<RightSidebar />);

    await screen.findByRole("button", { name: /Assignment: Notes/i });
    expect(screen.getByTestId("reminder-time")).toBeEmptyDOMElement();
    expect(screen.queryByText("All day")).not.toBeInTheDocument();
  });

  it("does not present a test opening hour as its due hour", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((input: RequestInfo | URL) => Promise.resolve({
      ok: true,
      json: async () => String(input).includes("upcoming=") ? [{
        id: "event-3", title: "Test: Practice", startDate: "2099-08-26T08:00:00.000Z", endDate: "2099-08-26T08:00:00.000Z",
        startTime: "09:00", endTime: null, isAllDay: false, source: "classroom", classroomId: "class-1", testId: "test-1", canEdit: true,
      }] : [],
    })));

    render(<RightSidebar />);

    await screen.findByRole("button", { name: /Test: Practice/i });
    expect(screen.getByTestId("reminder-time")).toBeEmptyDOMElement();
    expect(screen.queryByText("09:00")).not.toBeInTheDocument();
  });
});
