import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventDetailModal } from "./EventDetailModal";

vi.mock("@/components/settings/SettingsProvider", () => ({ useSettings: () => ({ reminderNotifications: true }) }));
afterEach(() => vi.unstubAllGlobals());

describe("EventDetailModal reminders", () => {
  it("offers a personal reminder only from an existing event", () => {
    render(<EventDetailModal
      open
      onClose={vi.fn()}
      onEventUpdated={vi.fn()}
      event={{ id: "event-1", title: "Biology test", startDate: "2099-08-09T00:00:00.000Z", startTime: "12:00", endTime: "13:00", isAllDay: false, source: "personal", canEdit: false, reminder: null }}
    />);
    expect(screen.getByText("Event reminder")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Event reminder" }));
    expect(screen.getByLabelText("Reminder date")).toBeInTheDocument();
    expect(screen.getByLabelText("Reminder time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set reminder" })).toBeInTheDocument();
  });

  it("edits the whole recurring series from an occurrence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "event-1", title: "Study", startDate: "2099-08-02T00:00:00.000Z", isAllDay: true,
      source: "personal", recurrencePattern: "MONTHLY",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<EventDetailModal
      open onClose={vi.fn()} onEventUpdated={vi.fn()}
      event={{ id: "event-1::2099-09-02", seriesId: "event-1", seriesStartDate: "2099-08-02T00:00:00.000Z", title: "Study", startDate: "2099-09-02T00:00:00.000Z", isAllDay: true, source: "personal", canEdit: true, recurrencePattern: "WEEKLY" }}
    />);

    expect(screen.getByText("Repeats weekly")).toBeInTheDocument();
    expect(screen.queryByText("Event reminder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit event" }));
    expect(screen.getByLabelText("Date")).toHaveValue("2099-08-02");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Repeats: Weekly" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("menuitem", { name: "Monthly" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({ id: "event-1", recurrencePattern: "MONTHLY", startDate: "2099-08-02T00:00:00" });
  });

  it("opens the assignment editor for a linked classroom deadline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: "Essay",
      description: null,
      deadlineAt: "2099-08-26T19:00:00.000Z",
      deadlineTimeZone: "Europe/Budapest",
      deadlineHasTime: true,
      isGraded: true,
      maxPoints: 100,
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const onClose = vi.fn();
    render(<EventDetailModal
      open
      onClose={onClose}
      onEventUpdated={vi.fn()}
      event={{ id: "event-2", title: "Assignment: Essay", startDate: "2099-08-26T19:00:00.000Z", startTime: "21:00", endTime: "21:00", isAllDay: false, source: "classroom", classroomId: "class-1", assignmentId: "assignment-1", isProtected: true, canEdit: true, reminder: null }}
    />);

    expect(screen.getByRole("button", { name: "Delete assignment" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit assignment" }));
    expect(await screen.findByRole("heading", { name: "Edit assignment" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("deletes a linked assignment from its preview instead of deleting only the event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();
    const onEventUpdated = vi.fn();

    render(<EventDetailModal
      open
      onClose={onClose}
      onEventUpdated={onEventUpdated}
      event={{ id: "event-2", title: "Assignment: Essay", startDate: "2099-08-26T19:00:00.000Z", startTime: "21:00", endTime: "21:00", isAllDay: false, source: "classroom", classroomId: "class-1", assignmentId: "assignment-1", isProtected: true, canEdit: true, reminder: null }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Delete assignment" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/classrooms/class-1/assignments/assignment-1", { method: "DELETE" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() => expect(onEventUpdated).toHaveBeenCalled());
  });
});
