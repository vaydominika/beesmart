import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeftSidebar } from "./LeftSidebar";

const dashboardMock = vi.hoisted(() => ({
  state: { data: null as { streak: number } | null, loading: true },
}));
const navigationMock = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("@/lib/DashboardContext", () => ({ useDashboard: () => dashboardMock.state }));
vi.mock("next/navigation", () => ({ usePathname: () => navigationMock.pathname }));
vi.mock("@/components/focus/FocusProvider", () => ({ useFocus: () => ({ openModal: vi.fn() }) }));
vi.mock("@/components/settings/SettingsProvider", () => ({ useSettings: () => ({ openModal: vi.fn() }) }));
vi.mock("@/components/focus/FocusModal", () => ({ FocusModal: () => null }));

describe("LeftSidebar consistency counter", () => {
  beforeEach(() => {
    dashboardMock.state = { data: null, loading: true };
    navigationMock.pathname = "/dashboard";
  });

  it("shows a loading placeholder before dashboard data arrives", () => {
    render(<LeftSidebar />);
    expect(screen.getByText("Bee consistent")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses singular and plural day labels", () => {
    dashboardMock.state = { data: { streak: 1 }, loading: false };
    const { rerender } = render(<LeftSidebar />);
    expect(screen.getByText("day")).toBeInTheDocument();

    dashboardMock.state = { data: { streak: 4 }, loading: false };
    rerender(<LeftSidebar />);
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("aligns the consistency counter with the active navigation backdrop", () => {
    const { container } = render(<LeftSidebar variant="overlay" onClose={vi.fn()} />);

    expect(screen.getByText("Bee consistent").parentElement).toHaveClass("w-full", "md:w-[168px]", "md:p-2");
    expect(screen.getByRole("link", { name: "DASHBOARD" })).toHaveClass("mx-6", "w-[calc(100%-3rem)]", "justify-center", "text-center", "md:justify-start", "rounded-xl", "bg-[var(--app-canvas)]");
    expect(container.querySelector("[data-sidebar-active-indicator]")).not.toBeInTheDocument();
    expect(container.querySelector("#sidebar-container")).toHaveClass("rounded-tr-[30px]");
    expect(container.querySelector("#sidebar-container")).not.toHaveClass("rounded-br-[30px]");
  });

  it("centers the active label and keeps its backdrop static", () => {
    navigationMock.pathname = "/courses/course-1";
    const { container } = render(<LeftSidebar />);

    const activeLink = screen.getByRole("link", { name: "COURSES" });
    const indicator = container.querySelector("[data-sidebar-active-indicator]");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink).toHaveClass("flex", "items-center", "leading-none");
    expect(activeLink).not.toHaveClass("mt-2");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("-mt-0.5");
    expect(indicator).not.toHaveClass("sidebar-active-animation");
  });
});
