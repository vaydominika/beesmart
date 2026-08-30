import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const layout = vi.hoisted(() => ({
  isLeftSidebarOpen: false,
  isRightSidebarOpen: false,
  toggleLeftSidebar: vi.fn(),
  toggleRightSidebar: vi.fn(),
}));

vi.mock("./useIsMobile", () => ({ useIsMobile: () => true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("./LayoutProvider", () => ({ useLayout: () => layout }));
vi.mock("@/components/focus/FocusProvider", () => ({
  useFocus: () => ({ isSessionActive: false, timeRemaining: 0, currentMode: "active" }),
}));

describe("mobile Header", () => {
  it("uses the centered BeeSmart artwork as a dashboard link with balanced sidebar controls", () => {
    render(<Header />);

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    const profileButton = screen.getByRole("button", { name: "Open calendar and profile" });
    const logoLink = screen.getByRole("link", { name: "Go to dashboard" });
    const logo = screen.getByRole("img", { name: "BeeSmart Logo" });

    expect(screen.getByRole("navigation", { name: "Mobile application navigation" })).toHaveClass("grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]");
    expect(screen.getByRole("banner")).toHaveClass("bg-(--theme-sidebar)", "border-[var(--app-border)]");
    expect(menuButton).toHaveClass("h-10", "w-10", "rounded-xl");
    expect(profileButton).toHaveClass("h-10", "w-10", "rounded-xl");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(profileButton).toHaveAttribute("aria-expanded", "false");
    expect(logoLink).toHaveAttribute("href", "/dashboard");
    expect(logoLink).toHaveClass("w-24");
    expect(logo).toHaveClass("w-full");
  });
});
