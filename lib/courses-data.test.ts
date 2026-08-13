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

  it("returns account identity without deriving a classroom role", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Ada",
      avatar: null,
      image: "/provider-avatar.png",
      bannerImageUrl: "/banner.png",
    } as never);

    await expect(getCurrentUserById("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Ada",
      avatar: "/provider-avatar.png",
      bannerImageUrl: "/banner.png",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        name: true,
        avatar: true,
        image: true,
        bannerImageUrl: true,
      },
    });
  });
});
