import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleAgendaView } from "./ScheduleAgendaView";
import type { ScheduleEvent } from "@/lib/schedule";

const event: ScheduleEvent = {
  id: "event-1",
  title: "Algebra test",
  startDate: "2026-08-05T00:00:00.000Z",
  startTime: "09:00",
  endTime: "10:00",
  isAllDay: false,
  color: "#8acdb4",
  source: "classroom",
  classroomName: "Mathematics",
  canEdit: false,
};

const callbacks = {
  onSelectDate: vi.fn(),
  onSelectEvent: vi.fn(),
  onCreateDate: vi.fn(),
};

describe("ScheduleAgendaView", () => {
  it("shows the agenda empty state when there are no range events", () => {
    render(<ScheduleAgendaView events={[]} selectedDate={new Date(2026, 7, 5)} {...callbacks} />);

    expect(screen.getByText("Your next 30 days are clear")).toBeInTheDocument();
  });

  it("renders event details without a leading color dot", () => {
    const { container } = render(<ScheduleAgendaView events={[event]} selectedDate={new Date(2026, 7, 5)} {...callbacks} />);

    expect(screen.getByText("Algebra test")).toBeInTheDocument();
    expect(screen.getByText("Classroom · Mathematics")).toBeInTheDocument();
    expect(container.querySelector('[style*="background-color"]')).not.toBeInTheDocument();
  });
});
