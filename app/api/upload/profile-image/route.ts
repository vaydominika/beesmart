import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { getCurrentUserId, prisma } from "@/lib/db";
import { MalwareScanError, scanForMalware } from "@/lib/files/scanner";
import { deletePrivateFile, writePrivateFile } from "@/lib/files/storage";
import { UploadValidationError, validateUpload } from "@/lib/files/validation";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = new URL(request.url).searchParams.get("type");
  const imageType = typeParam === "banner" ? "banner" : "avatar";
  const purpose = imageType === "banner" ? "PROFILE_BANNER" : "PROFILE_AVATAR";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file" },
      { status: 400 }
    );
  }

  let validated;
  let scanStatus;
  try {
    validated = await validateUpload(file, purpose);
    scanStatus = await scanForMalware(validated.buffer);
  } catch (error) {
    const status = error instanceof UploadValidationError ? error.status : error instanceof MalwareScanError && error.infected ? 400 : 503;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image validation failed" }, { status });
  }
  const checksum = createHash("sha256").update(validated.buffer).digest("hex");
  const storageKey = `${checksum.slice(0, 2)}/${randomUUID()}`;

  try {
    await writePrivateFile(storageKey, validated.buffer);
    const stored = await prisma.storedFile.create({
      data: {
        ownerId: userId,
        purpose,
        storageKey,
        originalName: validated.originalName,
        detectedMime: validated.detectedMime,
        fileType: validated.fileType,
        size: validated.size,
        checksum,
        scanStatus,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return NextResponse.json({ uploadId: stored.id, url: `/api/files/${stored.id}` }, { status: 201 });
  } catch (e) {
    await deletePrivateFile(storageKey).catch(() => {});
    console.error("Profile image upload failed:", e);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

}
