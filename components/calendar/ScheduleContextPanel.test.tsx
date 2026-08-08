import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleContextPanel } from "./ScheduleContextPanel";

vi.mock("@/components/settings/SettingsProvider", () => ({
  useSettings: () => ({ reminderNotifications: true }),
}));

describe("ScheduleContextPanel reminders", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => vi.clearAllMocks());

  it("includes an optional reminder when creating an event", () => {
    const onSave = vi.fn();
    render(
      <ScheduleContextPanel
        selectedDate={new Date(2099, 7, 9)}
        events={[]}
        selectedEvent={null}
        editor={{ mode: "create", date: new Date(2099, 7, 9), startTime: "12:00", endTime: "13:00" }}
        saving={false}
        deleting={false}
        onSelectEvent={vi.fn()}
        onStartCreate={vi.fn()}
        onStartEdit={vi.fn()}
        onBack={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Biology test" } });
    fireEvent.click(screen.getByRole("switch", { name: "Event reminder" }));
    fireEvent.change(screen.getByLabelText("Reminder date"), { target: { value: "2099-08-09" } });
    fireEvent.change(screen.getByLabelText("Reminder time"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Biology test",
      reminder: {
        notifyAt: new Date("2099-08-09T10:00:00").toISOString(),
        eventStartsAt: new Date("2099-08-09T12:00:00").toISOString(),
        timeZone: expect.any(String),
      },
    }));
  });
});
