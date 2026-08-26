import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "./SettingsProvider";

function Probe() {
  const settings = useSettings();
  return (
    <div>
      <output data-testid="settings">{JSON.stringify({
        hydrated: settings.isHydrated,
        theme: settings.theme,
        active: settings.defaultActiveMinutes,
        visibility: settings.profileVisibility,
        saving: settings.isSaving,
      })}</output>
      <button onClick={() => settings.setTheme("dark")}>Use dark</button>
      <button onClick={() => void settings.saveSettingsToServer({ activitySharing: false })}>Save</button>
    </div>
  );
}

describe("SettingsProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("hydrates server settings, migrates legacy themes, and persists theme changes", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        theme: "ocean",
        defaultActiveMinutes: 30,
        defaultBreakMinutes: 5,
        defaultAutoBreak: false,
        reminderNotifications: false,
        classroomNotifications: true,
        profileVisibility: "public",
        activitySharing: true,
      }), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    render(<SettingsProvider><Probe /></SettingsProvider>);

    await waitFor(() => expect(screen.getByTestId("settings")).toHaveTextContent('"hydrated":true'));
    expect(screen.getByTestId("settings")).toHaveTextContent('"theme":"blue"');
    expect(screen.getByTestId("settings")).toHaveTextContent('"active":30');
    expect(screen.getByTestId("settings")).toHaveTextContent('"visibility":"public"');
    expect(document.documentElement).toHaveAttribute("data-theme", "blue");

    fireEvent.click(screen.getByRole("button", { name: "Use dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(JSON.parse(window.localStorage.getItem("beesmart-settings") ?? "{}")).toMatchObject({ theme: "dark" });
    expect(vi.mocked(fetch)).toHaveBeenLastCalledWith("/api/user/settings", expect.objectContaining({ method: "PATCH" }));
  });

  it("returns false when saving settings fails and always clears the saving state", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockRejectedValueOnce(new Error("offline"));

    render(<SettingsProvider><Probe /></SettingsProvider>);
    await waitFor(() => expect(screen.getByTestId("settings")).toHaveTextContent('"hydrated":true'));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("settings")).toHaveTextContent('"saving":false'));
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
