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
    },
  }),
}));
vi.mock("./CalendarWidget", () => ({ CalendarWidget: () => <div>Calendar</div> }));
vi.mock("@/components/dashboard/ReminderItem", () => ({ ReminderItem: () => <div>Reminder</div> }));
vi.mock("@/components/ui/BeeAvatar", () => ({ BeeAvatar: () => <div>Avatar</div> }));
vi.mock("@/components/calendar/EventModal", () => ({ EventModal: () => null }));
vi.mock("@/components/calendar/EventDetailModal", () => ({ EventDetailModal: () => null }));
vi.mock("@/hooks/use-event-sync", () => ({ useEventSync: () => ({ triggerUpdate: vi.fn() }) }));
vi.mock("./NotificationCenter", () => ({ NotificationCenter: () => null }));

describe("RightSidebar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });

  it("shows the account name without displaying a global role", () => {
    render(<RightSidebar />);

    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Legacy global role")).not.toBeInTheDocument();
  });
});
