import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "next-auth/react";
import { AuthenticatedApp } from "./AuthenticatedApp";

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));

describe("AuthenticatedApp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects an unauthenticated session to login and hides protected UI", async () => {
    vi.mocked(useSession).mockReturnValue({ status: "unauthenticated", data: null, update: vi.fn() });

    render(<AuthenticatedApp><div>Protected app</div></AuthenticatedApp>);

    expect(screen.queryByText("Protected app")).not.toBeInTheDocument();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
  });

  it("renders protected UI for an authenticated session", () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      data: { user: { id: "user-1", name: "Ada", email: "ada@example.com" }, expires: "2099-01-01" },
      update: vi.fn(),
    });

    render(<AuthenticatedApp><div>Protected app</div></AuthenticatedApp>);

    expect(screen.getByText("Protected app")).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
