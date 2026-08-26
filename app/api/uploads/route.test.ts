import { beforeEach, describe, expect, it, vi } from "vitest";
import { MalwareScanError } from "@/lib/files/scanner";
import { UploadValidationError } from "@/lib/files/validation";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(), storedFileCreate: vi.fn(), validateUpload: vi.fn(), scan: vi.fn(), write: vi.fn(), remove: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  prisma: { storedFile: { create: mocks.storedFileCreate } },
}));
vi.mock("@/lib/files/validation", async (importOriginal) => ({ ...(await importOriginal()), validateUpload: mocks.validateUpload }));
vi.mock("@/lib/files/scanner", async (importOriginal) => ({ ...(await importOriginal()), scanForMalware: mocks.scan }));
vi.mock("@/lib/files/storage", () => ({ writePrivateFile: mocks.write, deletePrivateFile: mocks.remove }));

import { POST } from "./route";

function uploadRequest(purpose = "TICKET_ATTACHMENT", includeFile = true) {
  const form = new FormData();
  if (includeFile) form.append("file", new File(["image"], "proof.png", { type: "image/png" }));
  form.append("purpose", purpose);
  return { formData: vi.fn().mockResolvedValue(form) } as unknown as Request;
}

const validated = {
  originalName: "proof.png", detectedMime: "image/png", extension: "png",
  fileType: "IMAGE", size: 5, buffer: Buffer.from("image"),
};

describe("uploads route", () => {
  beforeEach(() => {
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.validateUpload.mockResolvedValue(validated);
    mocks.scan.mockResolvedValue("CLEAN");
    mocks.write.mockResolvedValue(undefined);
    mocks.storedFileCreate.mockResolvedValue({ id: "upload-1", ...validated, size: 5, scanStatus: "CLEAN" });
  });

  it("validates the multipart contract", async () => {
    expect((await POST(uploadRequest("TICKET_ATTACHMENT", false))).status).toBe(400);
    expect((await POST(uploadRequest("NOT_A_PURPOSE"))).status).toBe(400);
  });

  it("stores validated, clean files privately and returns an opaque preview URL", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ uploadId: "upload-1", previewUrl: "/api/files/upload-1", scanStatus: "CLEAN" });
    expect(mocks.write).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{2}\/[0-9a-f-]+$/), validated.buffer);
    expect(mocks.storedFileCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "user-1", purpose: "TICKET_ATTACHMENT" }) }));
  });

  it("returns safe validation and malware-scanner errors", async () => {
    mocks.validateUpload.mockRejectedValueOnce(new UploadValidationError("Bad image", 422));
    expect((await POST(uploadRequest())).status).toBe(422);

    mocks.scan.mockRejectedValueOnce(new MalwareScanError("Malware detected", true));
    expect((await POST(uploadRequest())).status).toBe(400);
    mocks.scan.mockRejectedValueOnce(new MalwareScanError("Scanner unavailable"));
    expect((await POST(uploadRequest())).status).toBe(503);
  });

  it("removes the private file when database persistence fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.storedFileCreate.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("POST /api/uploads", expect.any(Error));
  });
});
