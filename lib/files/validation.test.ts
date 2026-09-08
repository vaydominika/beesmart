import { describe, expect, it } from "vitest";
import { UploadValidationError, validateUpload } from "./validation";

describe("validateUpload", () => {
  it("accepts safe UTF-8 text", async () => {
    const file = new File(["name,score\nAda,10"], "scores.csv", { type: "text/csv" });
    const result = await validateUpload(file, "POST_ATTACHMENT");
    expect(result.detectedMime).toBe("text/csv");
    expect(result.fileType).toBe("DOCUMENT");
  });

  it("rejects control bytes in text", async () => {
    const file = new File([new Uint8Array([65, 0, 66])], "notes.txt", { type: "text/plain" });
    await expect(validateUpload(file, "POST_ATTACHMENT")).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects active content and double-extension payloads", async () => {
    const html = new File(["<script>alert(1)</script>"], "report.pdf.html", { type: "text/html" });
    await expect(validateUpload(html, "POST_ATTACHMENT")).rejects.toThrow("Unsupported file extension");
  });

  it("rejects content that does not match its extension", async () => {
    const fakePdf = new File(["not a pdf"], "report.pdf", { type: "application/pdf" });
    await expect(validateUpload(fakePdf, "POST_ATTACHMENT")).rejects.toThrow("File contents do not match");
  });

  it("accepts animated PNG content with a .png extension", async () => {
    const apng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c,
      0, 0, 0, 1, 0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    const file = new File([apng], "animated.png", { type: "image/png" });

    const result = await validateUpload(file, "COURSE_COVER");

    expect(result.detectedMime).toBe("image/apng");
    expect(result.fileType).toBe("IMAGE");
  });

  it("only accepts images for ticket attachments", async () => {
    const file = new File(["name,score\nAda,10"], "scores.csv", { type: "text/csv" });
    await expect(validateUpload(file, "TICKET_ATTACHMENT")).rejects.toThrow("Ticket attachments must be");
  });
});
