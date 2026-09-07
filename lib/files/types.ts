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
  "TICKET_ATTACHMENT",
  "PROFILE_AVATAR",
  "PROFILE_BANNER",
]);

export function storedFileUrl(storedFileId: string | null | undefined, legacyUrl?: string | null) {
  return storedFileId ? `/api/files/${storedFileId}` : legacyUrl ?? "";
}

// Only public metadata is selected; storage keys and scan internals stay private.
export const attachmentInclude = {
  storedFile: { select: { originalName: true, fileType: true, size: true } },
} as const;

type SerializableAttachment = {
  id: string;
  storedFileId: string | null;
  isVisible: boolean;
  createdAt?: Date;
  legacyFileName: string | null;
  legacyFileUrl: string | null;
  legacyFileType: FileType | null;
  legacyFileSize: number | null;
  storedFile: { originalName: string; fileType: FileType; size: number } | null;
};

export function serializeAttachment(file: SerializableAttachment) {
  return {
    id: file.id,
    storedFileId: file.storedFileId,
    fileName: file.storedFile?.originalName ?? file.legacyFileName ?? "File unavailable",
    fileType: file.storedFile?.fileType ?? file.legacyFileType ?? "OTHER",
    fileSize: file.storedFile?.size ?? file.legacyFileSize ?? 0,
    fileUrl: storedFileUrl(file.storedFileId, file.legacyFileUrl),
    isVisible: file.isVisible,
    createdAt: file.createdAt,
  };
}
