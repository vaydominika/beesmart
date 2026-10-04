import { fireEvent, render, screen } from "@/test-utils/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_LOGIN_WELCOME_MESSAGE, selectDailyWelcomeMessage } from "@/lib/dashboard";
import { LanguageStateProvider } from "@/components/i18n/LanguageProvider";
import { WelcomeBanner } from "./WelcomeBanner";

const dashboardMock = vi.hoisted(() => ({
  state: {
    data: {
      user: { id: "user-1", name: "Dominika", image: null, bannerImageUrl: null },
    },
    loading: false,
  },
}));
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const navigationMock = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("@/lib/DashboardContext", () => ({ useDashboard: () => dashboardMock.state }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => navigationMock.searchParams,
}));

describe("WelcomeBanner", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    routerMock.replace.mockClear();
    navigationMock.searchParams = new URLSearchParams();
    document.body.innerHTML = '<div id="discover"></div>';
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows the user's stable daily message and preserves both discovery actions", () => {
    render(<WelcomeBanner />);

    expect(screen.getByRole("heading", { name: "Welcome back, Dominika" })).toBeInTheDocument();
    expect(screen.getByText(selectDailyWelcomeMessage("user-1"))).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "BeeSmart welcome bee" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Explore courses/ }));
    fireEvent.click(screen.getByRole("button", { name: /Make your own/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    expect(routerMock.push).toHaveBeenCalledWith("/courses");
  });

  it("welcomes a newly registered user without return-visit copy", () => {
    navigationMock.searchParams = new URLSearchParams({ welcome: "new" });

    render(<WelcomeBanner />);

    expect(screen.getByRole("heading", { name: "Welcome, Dominika" })).toBeInTheDocument();
    expect(screen.getByText(FIRST_LOGIN_WELCOME_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(selectDailyWelcomeMessage("user-1"))).not.toBeInTheDocument();
    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("renders the daily greeting in Hungarian and preserves the user's name", () => {
    render(<LanguageStateProvider initialLocale="hu"><WelcomeBanner /></LanguageStateProvider>);

    expect(screen.getByRole("heading", { name: "Üdv újra, Dominika" })).toBeInTheDocument();
    expect(screen.queryByText(selectDailyWelcomeMessage("user-1"))).not.toBeInTheDocument();
    expect(screen.getByRole("heading").nextElementSibling).toHaveTextContent(/kaptár|sziporkázó|mai napból|felfedeznivalók|fonalat/);
  });

  it("renders the first-visit greeting in Hungarian", () => {
    navigationMock.searchParams = new URLSearchParams({ welcome: "new" });
    render(<LanguageStateProvider initialLocale="hu"><WelcomeBanner /></LanguageStateProvider>);

    expect(screen.getByText("Minden készen áll a kaptárban! Fedezz fel egy kurzust, vagy készíts sajátot!")).toBeInTheDocument();
    expect(screen.queryByText(FIRST_LOGIN_WELCOME_MESSAGE)).not.toBeInTheDocument();
  });
});
