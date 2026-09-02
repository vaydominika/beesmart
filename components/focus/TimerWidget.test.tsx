import { fireEvent, render as testingRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isSessionActive: true, timeRemaining: 65, isRunning: true, isMinimized: false,
  pauseTimer: vi.fn(), resumeTimer: vi.fn(), undo: vi.fn(), next: vi.fn(), stopSession: vi.fn(), toggleMinimize: vi.fn(),
  widgetPosition: { x: 20, y: 100 }, setWidgetPosition: vi.fn(),
}));
vi.mock("./FocusProvider", () => ({ useFocus: () => state }));
vi.mock("react-draggable", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { TimerWidget } from "./TimerWidget";
import { TooltipProvider } from "@/components/ui/tooltip";

const render = (ui: ReactElement) => testingRender(ui, { wrapper: TooltipProvider });

describe("TimerWidget", () => {
  beforeEach(() => {
    state.isSessionActive = true;
    state.isRunning = true;
    state.isMinimized = false;
    state.timeRemaining = 65;
  });

  it("does not render outside an active session", () => {
    state.isSessionActive = false;
    const { container } = render(<TimerWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("formats time and connects every timer control", () => {
    render(<TimerWidget />);
    expect(screen.getByText("01:05")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo focus timer action" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause focus timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip to next focus timer interval" }));
    expect(state.undo).toHaveBeenCalled();
    expect(state.pauseTimer).toHaveBeenCalled();
    expect(state.next).toHaveBeenCalled();
  });

  it("uses resume while paused and renders the minimized control", () => {
    state.isRunning = false;
    const { rerender } = render(<TimerWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Resume focus timer" }));
    expect(state.resumeTimer).toHaveBeenCalled();
    state.isMinimized = true;
    rerender(<TimerWidget />);
    expect(screen.queryByText("01:05")).not.toBeInTheDocument();
  });
});
