import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";

const responsive = vi.hoisted(() => ({ isMobile: false, hasRoom: false }));
const layout = vi.hoisted(() => ({
  isLeftSidebarOpen: false,
  isRightSidebarOpen: false,
  toggleLeftSidebar: vi.fn(),
  toggleRightSidebar: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("./useIsMobile", () => ({
  useIsMobile: () => responsive.isMobile,
  useHasRoomForRightSidebar: () => responsive.hasRoom,
}));
vi.mock("./LayoutProvider", () => ({ useLayout: () => layout }));
vi.mock("./Header", () => ({ Header: () => null }));
vi.mock("./LeftSidebar", () => ({ LeftSidebar: () => <div>Left sidebar</div> }));
vi.mock("./RightSidebar", () => ({ RightSidebar: ({ variant }: { variant: string }) => <div data-testid="right-sidebar" data-variant={variant}>Right sidebar</div> }));
vi.mock("@/components/focus/TimerWidget", () => ({ TimerWidget: () => null }));
vi.mock("@/components/settings/Settings", () => ({ SettingsModal: () => null }));
vi.mock("@/components/settings/ProfileSettingsModal", () => ({ ProfileSettingsModal: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

describe("AppLayout responsive right sidebar", () => {
  beforeEach(() => {
    responsive.isMobile = false;
    responsive.hasRoom = false;
    layout.isLeftSidebarOpen = false;
    layout.isRightSidebarOpen = false;
  });

  it("keeps the right sidebar off-canvas when the content needs the space", () => {
    const { container } = render(<AppLayout><div>Main content</div></AppLayout>);

    expect(container.querySelector("[data-right-sidebar-shell]")).toHaveClass("fixed", "translate-x-full", "w-72");
    expect(screen.getByTestId("right-sidebar")).toHaveAttribute("data-variant", "overlay");
    expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveStyle({ right: "0px" });
  });

  it("reserves inline space for the right sidebar only on wide screens", () => {
    responsive.hasRoom = true;
    layout.isRightSidebarOpen = true;

    const { container } = render(<AppLayout><div>Main content</div></AppLayout>);

    expect(container.querySelector("[data-right-sidebar-shell]")).toHaveClass("relative", "w-72");
    expect(screen.getByTestId("right-sidebar")).toHaveAttribute("data-variant", "inline");
    expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveStyle({ right: "288px" });
  });
});
