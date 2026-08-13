import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    closeProfileModal: vi.fn(),
    profileVisibility: "private",
    activitySharing: true,
    setProfileVisibility: vi.fn(),
    setActivitySharing: vi.fn(),
    saveSettingsToServer: vi.fn(),
    isSaving: false,
  }),
}));
vi.mock("@/lib/DashboardContext", () => ({
  useDashboard: () => dashboardMock,
}));
vi.mock("../ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/BeeAvatar", () => ({ BeeAvatar: () => <div>Avatar</div> }));
vi.mock("../ui/switch", () => ({ Switch: () => <button type="button">Switch</button> }));
vi.mock("next/image", () => ({ default: () => <div>Banner preview</div> }));

describe("ProfileSettingsModal", () => {
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
});
