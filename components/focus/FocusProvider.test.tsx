import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/settings/SettingsProvider", () => ({
  useSettings: () => ({
    defaultActiveMinutes: 45,
    defaultBreakMinutes: 15,
    defaultAutoBreak: true,
    isHydrated: true,
  }),
}));

import { FocusProvider, useFocus } from "./FocusProvider";

function Probe() {
  const focus = useFocus();
  return (
    <div>
      <output data-testid="focus">{JSON.stringify({
        active: focus.isSessionActive,
        mode: focus.currentMode,
        remaining: focus.timeRemaining,
        running: focus.isRunning,
        error: focus.statsError,
        stats: focus.stats,
      })}</output>
      <button onClick={focus.openModal}>Open</button>
      <button onClick={() => focus.startSession({ activeMinutes: 1, breakMinutes: 1, autoBreak: false })}>Start</button>
      <button onClick={focus.pauseTimer}>Pause</button>
      <button onClick={focus.resumeTimer}>Resume</button>
      <button onClick={focus.stopSession}>Stop</button>
    </div>
  );
}

describe("FocusProvider", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("loads statistics when opened and exposes loading failures", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ focusCount: 3, breakCount: 2 }), { status: 200 }));
    render(<FocusProvider><Probe /></FocusProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByTestId("focus")).toHaveTextContent('"focusCount":3'));

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.getByTestId("focus")).toHaveTextContent("Could not load focus statistics"));
  });

  it("runs, pauses, resumes, and stops a deterministic session", () => {
    vi.useFakeTimers();
    render(<FocusProvider><Probe /></FocusProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByTestId("focus")).toHaveTextContent('"remaining":60');
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByTestId("focus")).toHaveTextContent('"remaining":59');

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByTestId("focus")).toHaveTextContent('"remaining":59');
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByTestId("focus")).toHaveTextContent('"running":true');

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByTestId("focus")).toHaveTextContent('"active":false');
    expect(screen.getByTestId("focus")).toHaveTextContent('"remaining":0');
  });

  it("retries a failed completed-session write once and reports the failure", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    render(<FocusProvider><Probe /></FocusProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByTestId("focus")).toHaveTextContent("A completed session could not be saved");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
