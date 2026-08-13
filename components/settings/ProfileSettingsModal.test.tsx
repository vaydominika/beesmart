import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

vi.mock("../ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("./SettingsProvider", () => ({
  useSettings: () => ({
    isProfileModalOpen: true,
    closeProfileModal: vi.fn(),
    profileVisibility: "PRIVATE",
    activitySharing: true,
    setProfileVisibility: vi.fn(),
    setActivitySharing: vi.fn(),
    saveSettingsToServer: vi.fn(),
    isSaving: false,
  }),
}));
vi.mock("@/lib/DashboardContext", () => ({
  useDashboard: () => ({
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
  }),
}));
vi.mock("../ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/BeeAvatar", () => ({ BeeAvatar: () => <div>Avatar</div> }));
vi.mock("../ui/switch", () => ({ Switch: () => <button type="button">Switch</button> }));
vi.mock("next/image", () => ({ default: () => <div>Banner preview</div> }));

describe("ProfileSettingsModal", () => {
  it("keeps profile identity settings without displaying a global role", () => {
    render(<ProfileSettingsModal />);

    expect(screen.getByRole("heading", { name: "PROFILE SETTINGS" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Legacy global role")).not.toBeInTheDocument();
    expect(screen.queryByText("ROLE")).not.toBeInTheDocument();
  });
});
