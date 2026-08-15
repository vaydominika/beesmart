import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppGroupLayout from "./layout";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("AppGroupLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated page renders to login", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("rejects a stale session without a user id", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "", name: "Guest", email: "guest@example.com" },
      expires: "2099-01-01",
    });

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("does not redirect an authenticated page render", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", name: "Ada", email: "ada@example.com" },
      expires: "2099-01-01",
    });

    await AppGroupLayout({ children: <div>Protected app</div> });

    expect(redirect).not.toHaveBeenCalled();
  });
});
