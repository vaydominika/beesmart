import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectDailyWelcomeMessage } from "@/lib/dashboard";
import { WelcomeBanner } from "./WelcomeBanner";

const dashboardMock = vi.hoisted(() => ({
  state: {
    data: {
      user: { id: "user-1", name: "Dominika", avatar: null, bannerImageUrl: null },
    },
    loading: false,
  },
}));
const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/DashboardContext", () => ({ useDashboard: () => dashboardMock.state }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

describe("WelcomeBanner", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    document.body.innerHTML = '<div id="discover"></div>';
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows the user's stable daily message and preserves both discovery actions", () => {
    render(<WelcomeBanner />);

    expect(screen.getByRole("heading", { name: "Welcome back, Dominika" })).toBeInTheDocument();
    expect(screen.getByText(selectDailyWelcomeMessage("user-1"))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "BeeSmart welcome bee" }).parentElement).toHaveClass("hidden", "lg:flex");

    fireEvent.click(screen.getByRole("button", { name: /Explore courses/ }));
    fireEvent.click(screen.getByRole("button", { name: /Make your own/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    expect(routerMock.push).toHaveBeenCalledWith("/courses");
  });
});
