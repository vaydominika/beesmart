import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Link from "next/link";
import { AppLayout } from "./AppLayout";

const responsive = vi.hoisted(() => ({ isMobile: false, hasRoom: false }));
const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));
const layout = vi.hoisted(() => ({
  isLeftSidebarOpen: false,
  isRightSidebarOpen: false,
  toggleLeftSidebar: vi.fn(),
  toggleRightSidebar: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("./useIsMobile", () => ({
  useIsMobile: () => responsive.isMobile,
  useHasRoomForRightSidebar: () => responsive.hasRoom,
}));
vi.mock("./LayoutProvider", () => ({ useLayout: () => layout }));
vi.mock("./Header", () => ({ Header: () => null }));
vi.mock("./LeftSidebar", () => ({ LeftSidebar: () => <Link href="/courses" data-testid="left-sidebar">Courses</Link> }));
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
    navigation.pathname = "/dashboard";
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

  it("keeps the course viewer focused on its own syllabus and reader", () => {
    navigation.pathname = "/courses/course-1/viewer";

    const { container } = render(<AppLayout><div>Course viewer</div></AppLayout>);

    expect(screen.queryByTestId("left-sidebar")).not.toBeInTheDocument();
    expect(container.querySelector("[data-right-sidebar-shell]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open sidebar" })).not.toBeInTheDocument();
  });

  it("remounts the staggered page entrance when navigation changes", () => {
    const { container, rerender } = render(<AppLayout><div>Main content</div></AppLayout>);
    const firstTransition = container.querySelector("[data-page-transition]");

    expect(firstTransition).toHaveClass("page-enter-stagger");

    navigation.pathname = "/courses";
    rerender(<AppLayout><div>Main content</div></AppLayout>);

    expect(container.querySelector("[data-page-transition]")).not.toBe(firstTransition);
  });

  it("shows the new page content after a client-side route transition", () => {
    const { rerender } = render(<AppLayout><div>Dashboard content</div></AppLayout>);
    navigation.pathname = "/courses";
    rerender(<AppLayout><div>Courses content</div></AppLayout>);

    expect(screen.getByText("Courses content")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });
});
