import type { FileType, UploadPurpose } from "@/lib/generated/prisma";

export type ValidatedUpload = {
  originalName: string;
  detectedMime: string;
  extension: string;
  fileType: FileType;
  size: number;
  buffer: Buffer;
};

export const UPLOAD_PURPOSES = new Set<UploadPurpose>([
  "COURSE_ATTACHMENT",
  "POST_ATTACHMENT",
  "SUBMISSION_ATTACHMENT",
  "COURSE_COVER",
]);

export function storedFileUrl(storedFileId: string | null | undefined, legacyUrl?: string | null) {
  return storedFileId ? `/api/files/${storedFileId}` : legacyUrl ?? "";
}
