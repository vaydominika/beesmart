import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { MalwareScanError, scanForMalware } from "@/lib/files/scanner";
import { UploadValidationError, validateUpload } from "@/lib/files/validation";

const MAX_SIZE_AVATAR = 2 * 1024 * 1024; // 2 MB
const MAX_SIZE_BANNER = 4 * 1024 * 1024; // 4 MB

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const typeParam = new URL(request.url).searchParams.get("type");
  const imageType = typeParam === "banner" ? "banner" : "avatar";
  const maxSize = imageType === "banner" ? MAX_SIZE_BANNER : MAX_SIZE_AVATAR;
  const subdir = imageType === "banner" ? "banners" : "avatars";

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

  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return NextResponse.json(
      { error: `File too large. Max ${maxMB} MB for ${imageType}.` },
      { status: 400 }
    );
  }

  let validated;
  try {
    validated = await validateUpload(file, "COURSE_COVER");
    await scanForMalware(validated.buffer);
  } catch (error) {
    const status = error instanceof UploadValidationError ? error.status : error instanceof MalwareScanError && error.infected ? 400 : 503;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image validation failed" }, { status });
  }
  const ext = validated.extension === "jpeg" ? "jpg" : validated.extension;
  const filename = `${userId}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", subdir);

  try {
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, validated.buffer);
  } catch (e) {
    console.error("Profile image upload failed:", e);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

  const url = `/uploads/${subdir}/${filename}`;
  return NextResponse.json({ url });
}
