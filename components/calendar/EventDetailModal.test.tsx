import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDetailModal } from "./EventDetailModal";

vi.mock("@/components/settings/SettingsProvider", () => ({ useSettings: () => ({ reminderNotifications: true }) }));

describe("EventDetailModal reminders", () => {
  it("offers a personal reminder only from an existing event", () => {
    render(<EventDetailModal
      open
      onClose={vi.fn()}
      onEventUpdated={vi.fn()}
      event={{ id: "event-1", title: "Biology test", startDate: "2099-08-09T00:00:00.000Z", startTime: "12:00", endTime: "13:00", isAllDay: false, canEdit: false, reminder: null }}
    />);
    expect(screen.getByText("Event reminder")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Event reminder" }));
    expect(screen.getByLabelText("Reminder date")).toBeInTheDocument();
    expect(screen.getByLabelText("Reminder time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set reminder" })).toBeInTheDocument();
  });
});
