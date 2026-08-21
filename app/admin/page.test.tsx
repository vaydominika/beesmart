import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getAdminTickets } from "@/lib/tickets";
import AdminPage from "./page";

const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tickets", () => ({ getAdminTickets: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

type MockSession = {
  user: { id: string; name: string; email: string };
  expires: string;
} | null;

const mockedAuth = vi.mocked(auth as unknown as () => Promise<MockSession>);

describe("standalone admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
  });

  it("conceals the page from users who are not configured administrators", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Learner", email: "learner@example.com" },
      expires: "2099-01-01",
    });

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getAdminTickets).not.toHaveBeenCalled();
  });

  it("loads tickets for a configured administrator", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "admin-1", name: "Ada Admin", email: "ADMIN@example.com" },
      expires: "2099-01-01",
    });
    vi.mocked(getAdminTickets).mockResolvedValue([]);

    const page = await AdminPage();

    expect(getAdminTickets).toHaveBeenCalledOnce();
    expect(page.props.currentAdmin).toEqual({ name: "Ada Admin", email: "ADMIN@example.com" });
  });
});
