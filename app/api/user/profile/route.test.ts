import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { claimUploads, markFilesForDeletion, purgeStoredFiles } from "@/lib/files/lifecycle";
import { getCurrentUserById } from "@/lib/courses-data";

const transactionClient = { user: { update: vi.fn() } };

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { user: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
vi.mock("@/lib/courses-data", () => ({ getCurrentUserById: vi.fn() }));
vi.mock("@/lib/files/lifecycle", () => ({
  UploadClaimError: class UploadClaimError extends Error {},
  claimUploads: vi.fn(),
  markFilesForDeletion: vi.fn(),
  purgeStoredFiles: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));

const request = (body: unknown) => new Request("http://localhost/api/user/profile", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Ada",
      password: "hash",
      avatar: "/api/files/old-avatar",
      avatarFileId: "old-avatar",
      bannerImageUrl: null,
      bannerFileId: null,
    } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: (client: typeof transactionClient) => Promise<unknown>) => callback(transactionClient)) as never);
    vi.mocked(getCurrentUserById).mockResolvedValue({ id: "user-1", name: "Ada" } as never);
    vi.mocked(claimUploads).mockResolvedValue([{ id: "new-avatar" }] as never);
  });

  it("rejects arbitrary profile image URLs", async () => {
    const response = await PATCH(request({ avatar: "https://tracker.example/avatar.png" }));
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("claims an owned profile upload and retires the replaced file", async () => {
    const response = await PATCH(request({ avatar: "/api/files/new-avatar" }));
    expect(response.status).toBe(200);
    expect(claimUploads).toHaveBeenCalledWith(transactionClient, ["new-avatar"], "user-1", "PROFILE_AVATAR");
    expect(transactionClient.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ avatar: "/api/files/new-avatar", avatarFileId: "new-avatar" }),
    }));
    expect(markFilesForDeletion).toHaveBeenCalledWith(transactionClient, ["old-avatar"]);
    expect(purgeStoredFiles).toHaveBeenCalledWith(["old-avatar"]);
  });

  it("requires both password fields", async () => {
    expect((await PATCH(request({ newPassword: "a-secure-new-password" }))).status).toBe(400);
  });
});
