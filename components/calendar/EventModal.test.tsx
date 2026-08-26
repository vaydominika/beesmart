import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: mocks }));
vi.mock("framer-motion", () => ({
  Reorder: {
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
  useDragControls: () => ({ start: vi.fn() }),
}));

import { EventModal } from "./EventModal";

const existingEvent = {
  id: "event-1", title: "Existing event", description: null,
  startDate: "2026-08-26T00:00:00.000Z", startTime: "09:00", endTime: "10:00",
  isAllDay: false, canEdit: true,
};

describe("EventModal", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("loads only the selected day's events", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([
      existingEvent,
      { ...existingEvent, id: "other", title: "Other day", startDate: "2026-08-27T00:00:00.000Z" },
    ]), { status: 200 }));
    render(<EventModal open onClose={vi.fn()} selectedDate={new Date(2026, 7, 26)} onEventsChanged={vi.fn()} />);
    expect(await screen.findByText("Existing event")).toBeVisible();
    expect(screen.queryByText("Other day")).not.toBeInTheDocument();
  });

  it("validates required title and time ordering", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    render(<EventModal open onClose={vi.fn()} selectedDate={new Date(2026, 7, 26)} onEventsChanged={vi.fn()} initialStartTime="11:00" initialEndTime="10:00" />);
    await screen.findByText("No events yet. Add the first one below.");
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    expect(mocks.error).toHaveBeenCalledWith("Please enter a title.");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Workshop" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    expect(mocks.error).toHaveBeenCalledWith("End time must be later than start time.");
  });

  it("creates an event and refreshes the day", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "new-event" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([existingEvent]), { status: 200 }));
    const onEventsChanged = vi.fn();
    render(<EventModal open onClose={vi.fn()} selectedDate={new Date(2026, 7, 26)} onEventsChanged={onEventsChanged} />);
    await screen.findByText("No events yet. Add the first one below.");
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: " New workshop " } });
    fireEvent.change(screen.getByLabelText("Description Optional"), { target: { value: " Notes " } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Event created"));
    expect(vi.mocked(fetch)).toHaveBeenNthCalledWith(2, "/api/user/events", expect.objectContaining({ method: "POST" }));
    const options = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({ title: "New workshop", description: "Notes", startTime: "09:00", endTime: "10:00" });
  });
});
