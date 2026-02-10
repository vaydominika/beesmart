import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

  const mime = file.type;
  if (!ALLOWED_TYPES.includes(mime as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Invalid file type. Use JPEG, PNG, WebP, or GIF." },
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

  const ext = EXT_BY_MIME[mime] ?? "jpg";
  const filename = `${userId}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", subdir);

  try {
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);
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
