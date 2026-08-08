import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicProfile } from "./public-profile";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: vi.fn() }, course: { findMany: vi.fn() }, activityRecord: { findMany: vi.fn() }, classroomMember: { findMany: vi.fn() },
} }));

describe("getPublicProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not expose a private profile to another user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2", name: "Private learner", avatar: null, image: null, bannerImageUrl: null, createdAt: new Date(), settings: { profileVisibility: "PRIVATE", activitySharing: true } } as never);
    const result = await getPublicProfile("user-2", "user-1");
    expect(result).toEqual({ status: "private", user: { id: "user-2", name: "Private learner" } });
    expect(prisma.course.findMany).not.toHaveBeenCalled();
  });

  it("omits activity when sharing is disabled", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-2", name: "Learner", avatar: null, image: null, bannerImageUrl: null, createdAt: new Date("2026-01-01"), settings: { profileVisibility: "PUBLIC", activitySharing: false } } as never);
    vi.mocked(prisma.course.findMany).mockResolvedValue([] as never);
    const result = await getPublicProfile("user-2", "user-1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.profile.activity).toEqual([]);
    expect(prisma.activityRecord.findMany).not.toHaveBeenCalled();
  });
});
