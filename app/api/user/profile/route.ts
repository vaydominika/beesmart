import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, getCurrentUserId } from "@/lib/db";
import { getCurrentUserById } from "@/lib/courses-data";
import { unlink } from "node:fs/promises";
import path from "node:path";

async function removeReplacedProfileImage(url: string | null, subdir: "avatars" | "banners") {
  if (!url?.startsWith(`/uploads/${subdir}/`)) return;
  const root = path.resolve(process.cwd(), "public", "uploads", subdir);
  const target = path.resolve(process.cwd(), "public", `.${url}`);
  if (!target.startsWith(`${root}${path.sep}`)) return;
  try { await unlink(target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("profile_image_cleanup_failed", { subdir, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    avatar?: string | null;
    bannerImageUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.currentPassword != null && body.newPassword != null) {
    if (!user.password) {
      return NextResponse.json(
        { error: "Account uses social sign-in; set a password in your provider or use password reset" },
        { status: 400 }
      );
    }
    const match = await bcrypt.compare(body.currentPassword, user.password);
    if (!match) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }
  }

  const updateData: {
    name?: string;
    avatar?: string | null;
    bannerImageUrl?: string | null;
    password?: string;
  } = {};

  if (body.name !== undefined) updateData.name = body.name.trim() || user.name;
  if (body.avatar !== undefined) updateData.avatar = body.avatar?.trim() || null;
  if (body.bannerImageUrl !== undefined)
    updateData.bannerImageUrl = body.bannerImageUrl?.trim() || null;
  if (body.newPassword != null && body.newPassword.length > 0)
    updateData.password = await bcrypt.hash(body.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  if (body.avatar !== undefined && user.avatar !== updateData.avatar) await removeReplacedProfileImage(user.avatar, "avatars");
  if (body.bannerImageUrl !== undefined && user.bannerImageUrl !== updateData.bannerImageUrl) await removeReplacedProfileImage(user.bannerImageUrl, "banners");

  const updatedUser = await getCurrentUserById(userId);
  return NextResponse.json({ user: updatedUser });
}
