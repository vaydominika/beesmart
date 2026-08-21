import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppGroupLayout from "./layout";
import type { MockSession } from "@/test-utils/session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockedAuth = vi.mocked(auth as unknown as () => Promise<MockSession>);

describe("AppGroupLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated page renders to login", async () => {
    mockedAuth.mockResolvedValue(null);

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("rejects a stale session without a user id", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "", name: "Guest", email: "guest@example.com" },
      expires: "2099-01-01",
    });

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("does not redirect an authenticated page render", async () => {
    mockedAuth.mockResolvedValue({
      user: { id: "user-1", name: "Ada", email: "ada@example.com" },
      expires: "2099-01-01",
    });

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).not.toHaveBeenCalled();
  });
});
