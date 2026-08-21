import { render, screen } from "@testing-library/react";
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
        avatar: null,
        bannerImageUrl: null,
        role: "Legacy global role",
      },
      activeTicketCount: 2,
    },
  }),
}));
vi.mock("./CalendarWidget", () => ({ CalendarWidget: () => <div>Calendar</div> }));
vi.mock("@/components/dashboard/ReminderItem", () => ({ ReminderItem: () => <div>Reminder</div> }));
vi.mock("@/components/calendar/EventModal", () => ({ EventModal: () => null }));
vi.mock("@/components/calendar/EventDetailModal", () => ({ EventDetailModal: () => null }));
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

    expect(notificationButton.compareDocumentPosition(closeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(avatar.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links a subtle active-ticket count to My Reports", () => {
    render(<RightSidebar />);
    expect(screen.getByRole("link", { name: "Active tickets: 2" })).toHaveAttribute("href", "/tickets");
  });
});
