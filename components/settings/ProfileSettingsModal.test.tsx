import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

const dashboardMock = vi.hoisted(() => ({
  data: {
    user: {
      id: "user-1",
      name: "Ada",
      avatar: null,
      bannerImageUrl: null,
      role: "Legacy global role",
    },
  },
  refetch: vi.fn(),
}));
const settingsMock = vi.hoisted(() => ({
  closeProfileModal: vi.fn(),
  setProfileVisibility: vi.fn(),
  setActivitySharing: vi.fn(),
  saveSettingsToServer: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ push: vi.fn(), error: vi.fn(), success: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));

vi.mock("../ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("./SettingsProvider", () => ({
  useSettings: () => ({
    isProfileModalOpen: true,
    closeProfileModal: settingsMock.closeProfileModal,
    profileVisibility: "private",
    activitySharing: true,
    setProfileVisibility: settingsMock.setProfileVisibility,
    setActivitySharing: settingsMock.setActivitySharing,
    saveSettingsToServer: settingsMock.saveSettingsToServer,
    isSaving: false,
  }),
}));
vi.mock("@/lib/DashboardContext", () => ({
  useDashboard: () => dashboardMock,
}));
vi.mock("../ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/switch", () => ({ Switch: () => <button type="button">Switch</button> }));
vi.mock("next/image", () => ({ default: () => <div>Banner preview</div> }));

describe("ProfileSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsMock.saveSettingsToServer).mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps profile identity settings without displaying a global role", () => {
    render(<ProfileSettingsModal />);

    expect(screen.getByRole("heading", { name: "Profile settings" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Legacy global role")).not.toBeInTheDocument();
    expect(screen.queryByText("ROLE")).not.toBeInTheDocument();
  });

  it("uses the shared tab switch for profile visibility", () => {
    render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));

    expect(screen.getByRole("tablist", { name: "Profile visibility" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Private" })).toHaveAttribute("aria-selected", "true");
  });

  it("validates password confirmation and minimum length", () => {
    render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "long-enough-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("New passwords don't match.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("New password must be at least 12 characters.")).toBeInTheDocument();
  });

  it("saves normalized profile and password data with privacy settings", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    render(<ProfileSettingsModal />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Ada Lovelace  " } });
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secure-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "new-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(settingsMock.closeProfileModal).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith("/api/user/profile", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ name: "Ada Lovelace", avatar: null, bannerImageUrl: null, currentPassword: "old-password", newPassword: "new-secure-password" }),
    }));
    expect(settingsMock.saveSettingsToServer).toHaveBeenCalledWith({ profileVisibility: "private", activitySharing: true });
    expect(dashboardMock.refetch).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Profile updated");
  });

  it("shows safe API and privacy persistence errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Current password is wrong" }), { status: 400 }));
    const first = render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Current password is wrong")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("Current password is wrong");
    first.unmount();

    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.mocked(settingsMock.saveSettingsToServer).mockResolvedValue(false);
    render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Profile updated, but privacy settings could not be saved.")).toBeInTheDocument();
  });

  it("uploads avatar and banner images and includes them in the update", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "/avatar-new.png" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "/banner-new.png" }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { container } = render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Images" }));
    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [new File(["a"], "avatar.png", { type: "image/png" })] } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/upload/profile-image?type=avatar", expect.any(Object)));
    fireEvent.change(fileInputs[1], { target: { files: [new File(["b"], "banner.png", { type: "image/png" })] } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/upload/profile-image?type=banner", expect.any(Object)));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(settingsMock.closeProfileModal).toHaveBeenCalled());
    expect(fetch).toHaveBeenLastCalledWith("/api/user/profile", expect.objectContaining({
      body: JSON.stringify({ name: "Ada", avatar: "/avatar-new.png", bannerImageUrl: "/banner-new.png" }),
    }));
  });

  it("reports upload failures and opens the public profile", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "Image too large" }), { status: 413 }));
    const { container } = render(<ProfileSettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "Images" }));
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File(["x"], "large.png", { type: "image/png" })] },
    });
    expect(await screen.findByText("Image too large")).toBeInTheDocument();
    expect(mocks.error).toHaveBeenCalledWith("Image too large");

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(screen.getAllByRole("button", { name: "View profile" })[0]);
    expect(settingsMock.closeProfileModal).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/profile/user-1");
  });
});
