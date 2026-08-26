import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), toastInfo: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { info: mocks.toastInfo } }));

import { NotificationCenter } from "./NotificationCenter";

const notification = {
  id: "notification-1",
  title: "Assignment due",
  body: "Submit before tomorrow",
  category: "GENERAL",
  readAt: null,
  relatedId: "assignment-1",
  relatedType: "assignment",
  actionUrl: "/classroom/c-1/assignments/a-1",
  createdAt: "2026-02-16T09:59:30.000Z",
};

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads, displays, opens, and marks a notification read", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [notification], unreadCount: 1, triggeredReminders: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...notification, readAt: "2026-02-16T10:00:00.000Z" }), { status: 200 }));

    render(<NotificationCenter />);
    const trigger = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(await screen.findByText("Assignment due")).toBeVisible();
    expect(screen.getByText("Just now")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Assignment due/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/classroom/c-1/assignments/a-1"));
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith("/api/notifications", expect.objectContaining({ method: "PATCH" }));
  });

  it("marks every visible notification read", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ notifications: [notification], unreadCount: 1, triggeredReminders: [{ task: "Study" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    render(<NotificationCenter />);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Notifications, 1 unread" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(screen.getByText("You're all caught up")).toBeVisible());
    expect(mocks.toastInfo).toHaveBeenCalledWith("Reminder: Study");
  });
});
