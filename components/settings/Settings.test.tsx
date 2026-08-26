import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeModal: vi.fn(), setTheme: vi.fn(), setActive: vi.fn(), setBreak: vi.fn(), setAuto: vi.fn(),
  setReminders: vi.fn(), setClassroom: vi.fn(), save: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("./SettingsProvider", () => ({ useSettings: () => ({
  isModalOpen: true,
  closeModal: mocks.closeModal,
  theme: "bee",
  setTheme: mocks.setTheme,
  defaultActiveMinutes: 45,
  defaultBreakMinutes: 15,
  defaultAutoBreak: true,
  setDefaultActiveMinutes: mocks.setActive,
  setDefaultBreakMinutes: mocks.setBreak,
  setDefaultAutoBreak: mocks.setAuto,
  reminderNotifications: true,
  classroomNotifications: true,
  setReminderNotifications: mocks.setReminders,
  setClassroomNotifications: mocks.setClassroom,
  saveSettingsToServer: mocks.save,
  isSaving: false,
}) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { SettingsModal } from "./Settings";

describe("SettingsModal", () => {
  beforeEach(() => mocks.save.mockResolvedValue(true));

  it("offers all supported themes", () => {
    render(<SettingsModal />);
    for (const theme of ["Bee", "Moon", "Flower", "Lake"]) expect(screen.getByRole("button", { name: new RegExp(theme) })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Moon/ }));
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("clamps focus defaults before saving", async () => {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Focus timer" }));
    fireEvent.change(screen.getByLabelText("Focus minutes"), { target: { value: "999" } });
    fireEvent.change(screen.getByLabelText("Break minutes"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ defaultActiveMinutes: 120, defaultBreakMinutes: 1 }));
    expect(mocks.setActive).toHaveBeenCalledWith(120);
    expect(mocks.setBreak).toHaveBeenCalledWith(1);
    expect(mocks.success).toHaveBeenCalledWith("Settings saved");
    expect(mocks.closeModal).toHaveBeenCalled();
  });

  it("keeps local changes and reports a server save failure", async () => {
    mocks.save.mockResolvedValue(false);
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Failed to save settings. Changes saved locally."));
  });
});
