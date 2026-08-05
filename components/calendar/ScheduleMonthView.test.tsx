import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleMonthView } from "./ScheduleMonthView";
import type { ScheduleEvent } from "@/lib/schedule";

const event: ScheduleEvent = {
  id: "event-1",
  title: "Algebra test",
  startDate: "2026-08-05T00:00:00.000Z",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  color: "#FADA6D",
  source: "classroom",
  canEdit: false,
};

describe("ScheduleMonthView", () => {
  it("renders events returned with ISO timestamps", () => {
    render(<ScheduleMonthView selectedDate={new Date(2026, 7, 5)} events={[event]} onSelectDate={vi.fn()} onSelectEvent={vi.fn()} onCreateDate={vi.fn()} />);
    expect(screen.getByText(/Algebra test/)).toBeInTheDocument();
  });

  it("exposes a direct new-event action for a date", () => {
    const onCreateDate = vi.fn();
    render(<ScheduleMonthView selectedDate={new Date(2026, 7, 5)} events={[]} onSelectDate={vi.fn()} onSelectEvent={vi.fn()} onCreateDate={onCreateDate} />);
    fireEvent.click(screen.getByRole("button", { name: "New event on August 5" }));
    expect(onCreateDate).toHaveBeenCalledWith(expect.any(Date));
  });
});
