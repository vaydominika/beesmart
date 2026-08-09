import type { Prisma, UploadPurpose } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { deletePrivateFile } from "./storage";

type DbClient = Prisma.TransactionClient;

export class UploadClaimError extends Error {}

export async function claimUploads(tx: DbClient, uploadIds: string[], ownerId: string, purpose: UploadPurpose) {
  const ids = [...new Set(uploadIds.filter((id) => typeof id === "string" && id))];
  if (ids.length !== uploadIds.length) throw new UploadClaimError("Upload IDs must be unique and valid");
  if (ids.length === 0) return [];

  const files = await tx.storedFile.findMany({
    where: {
      id: { in: ids }, ownerId, purpose, state: "PENDING",
      scanStatus: { in: ["CLEAN", "NOT_REQUIRED"] }, expiresAt: { gt: new Date() },
    },
  });
  if (files.length !== ids.length) throw new UploadClaimError("One or more uploads are unavailable, expired, or do not belong to you");

  const claimed = await tx.storedFile.updateMany({
    where: { id: { in: ids }, state: "PENDING" },
    data: { state: "ATTACHED", expiresAt: new Date("9999-12-31T23:59:59.000Z") },
  });
  if (claimed.count !== ids.length) throw new UploadClaimError("One or more uploads were already claimed");
  const byId = new Map(files.map((file: any) => [file.id, file]));
  return ids.map((id) => byId.get(id)!);
}

export async function markFilesForDeletion(tx: DbClient, storedFileIds: string[]) {
  const ids = [...new Set(storedFileIds.filter(Boolean))];
  if (!ids.length) return;
  await tx.storedFile.updateMany({ where: { id: { in: ids } }, data: { state: "DELETE_PENDING" } });
}

export async function purgeStoredFiles(storedFileIds: string[]) {
  const files = await prisma.storedFile.findMany({
    where: { id: { in: [...new Set(storedFileIds)] }, state: "DELETE_PENDING" },
    select: { id: true, storageKey: true },
  });
  for (const file of files) {
    try {
      await deletePrivateFile(file.storageKey);
      await prisma.storedFile.delete({ where: { id: file.id } });
    } catch (error) {
      console.error("file_cleanup_failed", { storedFileId: file.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export async function cleanupStoredFiles(limit = 100) {
  const now = new Date();
  await prisma.storedFile.updateMany({
    where: { state: "PENDING", expiresAt: { lte: now } },
    data: { state: "DELETE_PENDING" },
  });
  const files = await prisma.storedFile.findMany({
    where: { state: "DELETE_PENDING" }, orderBy: { updatedAt: "asc" }, take: limit, select: { id: true },
  });
  await purgeStoredFiles(files.map((file: any) => file.id));
  return files.length;
}
