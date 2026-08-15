import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getDashboardData } from "@/lib/courses-data";
import { getCurrentUserId } from "@/lib/db";

vi.mock("@/lib/db", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/courses-data", () => ({ getDashboardData: vi.fn() }));

describe("GET /api/dashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not return guest dashboard data", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getDashboardData).not.toHaveBeenCalled();
  });

  it("returns dashboard data for an authenticated user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getDashboardData).mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getDashboardData).toHaveBeenCalledOnce();
  });
});
