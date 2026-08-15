import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getCurrentUserById } from "./courses-data";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

describe("getCurrentUserById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves the avatar empty when only a provider placeholder exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Ada",
      avatar: null,
      bannerImageUrl: "/banner.png",
    } as never);

    await expect(getCurrentUserById("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Ada",
      avatar: null,
      bannerImageUrl: "/banner.png",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        name: true,
        avatar: true,
        bannerImageUrl: true,
      },
    });
  });
});
