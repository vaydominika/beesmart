import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

import { DashboardProvider, useDashboard } from "./DashboardContext";

function Probe() {
  const dashboard = useDashboard();
  return <div><output data-testid="dashboard">{JSON.stringify(dashboard)}</output><button onClick={() => void dashboard.refetch()}>Refresh</button></div>;
}

describe("DashboardProvider", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("loads and refreshes dashboard data", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: "user-1" }, reminders: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: "user-1" }, reminders: [{ id: "r-1" }] }), { status: 200 }));
    render(<DashboardProvider><Probe /></DashboardProvider>);
    await waitFor(() => expect(screen.getByTestId("dashboard")).toHaveTextContent('"loading":false'));
    expect(screen.getByTestId("dashboard")).toHaveTextContent('"reminders":[]');
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByTestId("dashboard")).toHaveTextContent('"id":"r-1"'));
  });

  it("redirects expired sessions and reports server failures", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("dashboard unavailable", { status: 503 }));
    render(<DashboardProvider><Probe /></DashboardProvider>);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/login"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByTestId("dashboard")).toHaveTextContent("dashboard unavailable"));
  });

  it("requires consumers to be nested under the provider", () => {
    expect(() => render(<Probe />)).toThrow("useDashboard must be used within DashboardProvider");
  });
});
