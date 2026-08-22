import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getCurrentUserId, prisma } from "@/lib/db";
import { writePrivateFile } from "@/lib/files/storage";
import { validateUpload } from "@/lib/files/validation";

vi.mock("@/lib/db", () => ({
  getCurrentUserId: vi.fn(),
  prisma: { storedFile: { create: vi.fn() } },
}));
vi.mock("@/lib/files/storage", () => ({ writePrivateFile: vi.fn(), deletePrivateFile: vi.fn() }));
vi.mock("@/lib/files/scanner", () => ({
  MalwareScanError: class MalwareScanError extends Error { infected = false; },
  scanForMalware: vi.fn().mockResolvedValue("CLEAN"),
}));
vi.mock("@/lib/files/validation", () => ({
  UploadValidationError: class UploadValidationError extends Error { status = 400; },
  validateUpload: vi.fn(),
}));

describe("POST /api/upload/profile-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(validateUpload).mockResolvedValue({
      originalName: "avatar.png",
      detectedMime: "image/png",
      extension: "png",
      fileType: "IMAGE",
      size: 4,
      buffer: Buffer.from("image"),
    });
    vi.mocked(prisma.storedFile.create).mockResolvedValue({ id: "stored-1" } as never);
  });

  it("writes avatars to private storage and returns a protected URL", async () => {
    const form = new FormData();
    form.set("file", new File(["image"], "avatar.png", { type: "image/png" }));
    const response = await POST({
      url: "http://localhost/api/upload/profile-image?type=avatar",
      formData: vi.fn().mockResolvedValue(form),
    } as unknown as Request);
    expect(response.status).toBe(201);
    expect(validateUpload).toHaveBeenCalledWith(expect.any(File), "PROFILE_AVATAR");
    expect(writePrivateFile).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ uploadId: "stored-1", url: "/api/files/stored-1" });
  });
});
