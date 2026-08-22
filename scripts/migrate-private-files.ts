import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import type { FileType, UploadPurpose } from "../lib/generated/prisma";
import { prisma } from "../lib/db";
import { scanForMalware } from "../lib/files/scanner";
import { deletePrivateFile, writePrivateFile } from "../lib/files/storage";

const apply = process.argv.includes("--apply");
const removePublic = apply && process.argv.includes("--remove-public");
const publicRoot = path.resolve(process.cwd(), "public");
let migrated = 0;
let skipped = 0;

function legacyPath(fileUrl: string) {
  if (!fileUrl.startsWith("/uploads/")) throw new Error("Not a managed legacy upload");
  const resolved = path.resolve(publicRoot, `.${fileUrl}`);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`)) throw new Error("Unsafe legacy path");
  return resolved;
}

async function migrateOne(input: {
  fileUrl: string; ownerId: string; purpose: UploadPurpose; originalName: string; fileType: FileType;
  attach: (storedFileId: string) => Promise<unknown>;
}) {
  try {
    const buffer = await readFile(legacyPath(input.fileUrl));
    const detected = await fileTypeFromBuffer(buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const scanStatus = await scanForMalware(buffer);
    if (!apply) { migrated++; return; }
    const storageKey = `${checksum.slice(0, 2)}/${randomUUID()}`;
    await writePrivateFile(storageKey, buffer);
    let storedFileId: string | null = null;
    try {
      const stored = await prisma.storedFile.create({ data: {
        ownerId: input.ownerId, purpose: input.purpose, storageKey, originalName: input.originalName,
        detectedMime: detected?.mime ?? "application/octet-stream", fileType: input.fileType,
        size: buffer.length, checksum, scanStatus, state: "ATTACHED",
        expiresAt: new Date("9999-12-31T23:59:59.000Z"),
      } });
      storedFileId = stored.id;
      await input.attach(stored.id);
    } catch (error) {
      if (storedFileId) await prisma.storedFile.deleteMany({ where: { id: storedFileId } });
      await deletePrivateFile(storageKey);
      throw error;
    }
    migrated++;
    if (removePublic) {
      try { await unlink(legacyPath(input.fileUrl)); }
      catch (error) { console.error(JSON.stringify({ event: "legacy_public_file_cleanup_failed", fileUrl: input.fileUrl, error: error instanceof Error ? error.message : String(error) })); }
    }
  } catch (error) {
    skipped++;
    console.error(JSON.stringify({ event: "legacy_file_migration_skipped", fileUrl: input.fileUrl, error: error instanceof Error ? error.message : String(error) }));
  }
}

try {
  const [courseFiles, postFiles, submissionFiles, covers, avatars, banners] = await Promise.all([
    prisma.courseFile.findMany({ where: { storedFileId: null, fileUrl: { startsWith: "/uploads/" } }, select: { id: true, fileUrl: true, fileName: true, fileType: true, uploadedById: true } }),
    prisma.postFile.findMany({ where: { storedFileId: null, fileUrl: { startsWith: "/uploads/" } }, select: { id: true, fileUrl: true, fileName: true, fileType: true, post: { select: { authorId: true } } } }),
    prisma.submissionFile.findMany({ where: { storedFileId: null, fileUrl: { startsWith: "/uploads/" } }, select: { id: true, fileUrl: true, fileName: true, fileType: true, submission: { select: { userId: true } } } }),
    prisma.course.findMany({ where: { coverStoredFileId: null, coverImageUrl: { startsWith: "/uploads/" } }, select: { id: true, coverImageUrl: true, createdById: true } }),
    prisma.user.findMany({ where: { avatarFileId: null, avatar: { startsWith: "/uploads/avatars/" } }, select: { id: true, avatar: true } }),
    prisma.user.findMany({ where: { bannerFileId: null, bannerImageUrl: { startsWith: "/uploads/banners/" } }, select: { id: true, bannerImageUrl: true } }),
  ]);

  for (const file of courseFiles) await migrateOne({ fileUrl: file.fileUrl!, ownerId: file.uploadedById, purpose: "COURSE_ATTACHMENT", originalName: file.fileName, fileType: file.fileType, attach: (id) => prisma.courseFile.update({ where: { id: file.id }, data: { storedFileId: id } }) });
  for (const file of postFiles) await migrateOne({ fileUrl: file.fileUrl!, ownerId: file.post.authorId, purpose: "POST_ATTACHMENT", originalName: file.fileName, fileType: file.fileType, attach: (id) => prisma.postFile.update({ where: { id: file.id }, data: { storedFileId: id } }) });
  for (const file of submissionFiles) await migrateOne({ fileUrl: file.fileUrl!, ownerId: file.submission.userId, purpose: "SUBMISSION_ATTACHMENT", originalName: file.fileName, fileType: file.fileType, attach: (id) => prisma.submissionFile.update({ where: { id: file.id }, data: { storedFileId: id } }) });
  for (const course of covers) await migrateOne({ fileUrl: course.coverImageUrl!, ownerId: course.createdById, purpose: "COURSE_COVER", originalName: path.basename(course.coverImageUrl!), fileType: "IMAGE", attach: (id) => prisma.course.update({ where: { id: course.id }, data: { coverStoredFileId: id } }) });
  for (const user of avatars) await migrateOne({ fileUrl: user.avatar!, ownerId: user.id, purpose: "PROFILE_AVATAR", originalName: path.basename(user.avatar!), fileType: "IMAGE", attach: (id) => prisma.user.update({ where: { id: user.id }, data: { avatarFileId: id, avatar: `/api/files/${id}` } }) });
  for (const user of banners) await migrateOne({ fileUrl: user.bannerImageUrl!, ownerId: user.id, purpose: "PROFILE_BANNER", originalName: path.basename(user.bannerImageUrl!), fileType: "IMAGE", attach: (id) => prisma.user.update({ where: { id: user.id }, data: { bannerFileId: id, bannerImageUrl: `/api/files/${id}` } }) });
  console.log(JSON.stringify({ event: "private_file_migration_complete", mode: apply ? "apply" : "dry-run", removePublic, migrated, skipped }));
} finally {
  await prisma.$disconnect();
}
