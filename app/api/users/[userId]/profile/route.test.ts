import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUserId: vi.fn(), getPublicProfile: vi.fn() }));
vi.mock("@/lib/db", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/public-profile", () => ({ getPublicProfile: mocks.getPublicProfile }));

import { GET } from "./route";

const context = { params: Promise.resolve({ userId: "profile-user" }) };

describe("public profile route", () => {
  it("maps not-found, private, and public results without leaking private data", async () => {
    mocks.getCurrentUserId.mockResolvedValue("viewer");
    mocks.getPublicProfile.mockResolvedValueOnce({ status: "not_found" });
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);

    mocks.getPublicProfile.mockResolvedValueOnce({ status: "private", user: { id: "profile-user", name: "Private User" } });
    const privateResponse = await GET(new Request("http://localhost"), context);
    expect(privateResponse.status).toBe(403);
    expect(await privateResponse.json()).toEqual({ error: "This profile is private", user: { id: "profile-user", name: "Private User" } });

    mocks.getPublicProfile.mockResolvedValueOnce({ status: "public", profile: { id: "profile-user", name: "Public User" } });
    const publicResponse = await GET(new Request("http://localhost"), context);
    expect(publicResponse.status).toBe(200);
    expect(await publicResponse.json()).toEqual({ id: "profile-user", name: "Public User" });
    expect(mocks.getPublicProfile).toHaveBeenLastCalledWith("profile-user", "viewer");
  });
});
