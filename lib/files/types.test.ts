import { describe, expect, it } from "vitest";
import { serializeAttachment } from "./types";

const attachment = {
  id: "attachment-1", storedFileId: null, isVisible: true,
  legacyFileName: null, legacyFileUrl: null, legacyFileSize: null, legacyFileType: null,
  storedFile: null,
};

describe("attachment serialization", () => {
  it("reads managed metadata from StoredFile without exposing storage internals", () => {
    const result = serializeAttachment({
      ...attachment, storedFileId: "stored-1",
      storedFile: { originalName: "lesson.pdf", size: 42, fileType: "PDF" },
    });
    expect(result).toMatchObject({ fileName: "lesson.pdf", fileSize: 42, fileType: "PDF", fileUrl: "/api/files/stored-1" });
    expect(result).not.toHaveProperty("storedFile");
    expect(result).not.toHaveProperty("legacyFileName");
  });

  it("preserves metadata and URLs for legacy uploads", () => {
    expect(serializeAttachment({
      ...attachment, legacyFileName: "old.png", legacyFileUrl: "/uploads/old.png",
      legacyFileSize: 1200, legacyFileType: "IMAGE",
    })).toMatchObject({ fileName: "old.png", fileUrl: "/uploads/old.png", fileSize: 1200, fileType: "IMAGE" });
  });

  it("prefers managed metadata when a legacy import has completed", () => {
    expect(serializeAttachment({
      ...attachment, storedFileId: "stored-1", legacyFileName: "old.png", legacyFileSize: 999,
      legacyFileUrl: "/uploads/old.png", legacyFileType: "IMAGE",
      storedFile: { originalName: "new.pdf", fileType: "PDF", size: 42 },
    })).toMatchObject({ fileName: "new.pdf", fileSize: 42, fileType: "PDF", fileUrl: "/api/files/stored-1" });
  });
});
