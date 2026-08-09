import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUserId, prisma } from "@/lib/db";
import type { UploadPurpose } from "@/lib/generated/prisma";
import { MalwareScanError, scanForMalware } from "@/lib/files/scanner";
import { deletePrivateFile, writePrivateFile } from "@/lib/files/storage";
import { UPLOAD_PURPOSES } from "@/lib/files/types";
import { UploadValidationError, validateUpload } from "@/lib/files/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const purpose = formData.get("purpose");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
    if (typeof purpose !== "string" || !UPLOAD_PURPOSES.has(purpose as UploadPurpose)) {
      return NextResponse.json({ error: "Invalid upload purpose" }, { status: 400 });
    }

    const validated = await validateUpload(file, purpose as UploadPurpose);
    const checksum = createHash("sha256").update(validated.buffer).digest("hex");
    let scanStatus;
    try {
      scanStatus = await scanForMalware(validated.buffer);
    } catch (error) {
      if (error instanceof MalwareScanError) {
        console.warn(error.infected ? "upload_malware_detected" : "upload_scanner_unavailable", { userId, purpose, fileName: validated.originalName });
        return NextResponse.json({ error: error.message }, { status: error.infected ? 400 : 503 });
      }
      throw error;
    }

    const storageKey = `${checksum.slice(0, 2)}/${randomUUID()}`;
    await writePrivateFile(storageKey, validated.buffer);
    try {
      const stored = await prisma.storedFile.create({
        data: {
          ownerId: userId, purpose: purpose as UploadPurpose, storageKey,
          originalName: validated.originalName, detectedMime: validated.detectedMime,
          fileType: validated.fileType, size: validated.size, checksum, scanStatus,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return NextResponse.json({
        uploadId: stored.id, fileName: stored.originalName, detectedMime: stored.detectedMime,
        fileType: stored.fileType, fileSize: stored.size, scanStatus: stored.scanStatus,
        previewUrl: `/api/files/${stored.id}`,
      }, { status: 201 });
    } catch (error) {
      await deletePrivateFile(storageKey);
      throw error;
    }
  } catch (error) {
    if (error instanceof UploadValidationError) {
      console.warn("upload_rejected", { userId, reason: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/uploads", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
