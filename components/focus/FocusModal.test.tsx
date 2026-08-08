import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FocusModal } from "./FocusModal";

const focusMock = {
  isModalOpen: true,
  closeModal: vi.fn(),
  activeMinutes: 45,
  breakMinutes: 15,
  autoBreak: true,
  setActiveMinutes: vi.fn(),
  setBreakMinutes: vi.fn(),
  setAutoBreak: vi.fn(),
  startSession: vi.fn(),
  stats: { focusCount: 7, breakCount: 5 },
  isStatsLoading: false,
  statsError: null,
};

vi.mock("./FocusProvider", () => ({ useFocus: () => focusMock }));

describe("FocusModal", () => {
  it("shows all-time focus and break totals", () => {
    render(<FocusModal />);
    expect(screen.getByText("Focus sessions").parentElement).toHaveTextContent("7");
    expect(screen.getByText("Breaks").parentElement).toHaveTextContent("5");
  });
});
