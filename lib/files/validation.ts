import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import type { FileType, UploadPurpose } from "@/lib/generated/prisma";
import type { ValidatedUpload } from "./types";

const MAX_DEFAULT = 10 * 1024 * 1024;
const MAX_COVER = 4 * 1024 * 1024;
const EXTENSIONS: Record<string, { mime: string; type: FileType }> = {
  jpg: { mime: "image/jpeg", type: "IMAGE" }, jpeg: { mime: "image/jpeg", type: "IMAGE" },
  png: { mime: "image/png", type: "IMAGE" }, gif: { mime: "image/gif", type: "IMAGE" }, webp: { mime: "image/webp", type: "IMAGE" },
  pdf: { mime: "application/pdf", type: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", type: "DOCUMENT" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", type: "DOCUMENT" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", type: "DOCUMENT" },
  doc: { mime: "application/msword", type: "DOCUMENT" },
  xls: { mime: "application/vnd.ms-excel", type: "DOCUMENT" },
  ppt: { mime: "application/vnd.ms-powerpoint", type: "DOCUMENT" },
  mp4: { mime: "video/mp4", type: "VIDEO" }, webm: { mime: "video/webm", type: "VIDEO" },
  mp3: { mime: "audio/mpeg", type: "AUDIO" }, wav: { mime: "audio/wav", type: "AUDIO" }, ogg: { mime: "audio/ogg", type: "AUDIO" },
  txt: { mime: "text/plain", type: "OTHER" }, csv: { mime: "text/csv", type: "DOCUMENT" },
};

const MIME_ALIASES: Record<string, string[]> = {
  "audio/wav": ["audio/wav", "audio/x-wav"],
  "text/csv": ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
};

export class UploadValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function isCfb(buffer: Buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

function isSafeText(buffer: Buffer) {
  if (buffer.includes(0)) return false;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return !/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text);
  } catch { return false; }
}

export async function validateUpload(file: File, purpose: UploadPurpose): Promise<ValidatedUpload> {
  if (!file.name || file.size <= 0) throw new UploadValidationError("A non-empty file is required");
  const max = purpose === "COURSE_COVER" ? MAX_COVER : MAX_DEFAULT;
  if (file.size > max) throw new UploadValidationError(`File too large. Maximum size is ${max / 1024 / 1024} MB.`);

  const extension = path.extname(file.name).slice(1).toLowerCase();
  const expected = EXTENSIONS[extension];
  if (!expected) throw new UploadValidationError("Unsupported file extension");
  if (purpose === "COURSE_COVER" && expected.type !== "IMAGE") throw new UploadValidationError("Course covers must be JPEG, PNG, GIF, or WebP");

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = extension === "txt" || extension === "csv"
    ? undefined
    : await fileTypeFromBuffer(Uint8Array.from(buffer));
  let detectedMime: string;
  if (extension === "txt" || extension === "csv") {
    if (!isSafeText(buffer)) throw new UploadValidationError("Text files must contain valid UTF-8 without control bytes");
    detectedMime = expected.mime;
  } else if (["doc", "xls", "ppt"].includes(extension) && isCfb(buffer)) {
    detectedMime = expected.mime;
  } else {
    if (!detected || detected.mime !== expected.mime) throw new UploadValidationError("File contents do not match the extension");
    detectedMime = detected.mime;
  }

  const declared = file.type.toLowerCase();
  const acceptedDeclared = MIME_ALIASES[expected.mime] ?? [expected.mime];
  if (declared && !acceptedDeclared.includes(declared)) throw new UploadValidationError("Declared MIME type does not match the file contents");

  return { originalName: path.basename(file.name), detectedMime, extension, fileType: expected.type, size: buffer.length, buffer };
}
