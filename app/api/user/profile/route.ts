import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, getCurrentUserId } from "@/lib/db";
import { getCurrentUserById } from "@/lib/courses-data";
import { claimUploads, markFilesForDeletion, purgeStoredFiles, UploadClaimError } from "@/lib/files/lifecycle";
import type { Prisma } from "@/lib/generated/prisma";

function storedFileId(value: string) {
  return /^\/api\/files\/([a-zA-Z0-9_-]+)$/.exec(value)?.[1] ?? null;
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

  const changingPassword = body.currentPassword != null || body.newPassword != null;
  if (changingPassword) {
    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
    }
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
    if (body.newPassword.length < 12 || body.newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password must be between 12 and 128 characters" },
        { status: 400 }
      );
    }
  }

  const name = body.name?.trim();
  if (name && name.length > 80) {
    return NextResponse.json({ error: "Name must be 80 characters or fewer" }, { status: 400 });
  }
  const nextAvatar = body.avatar === undefined ? undefined : body.avatar?.trim() || null;
  const nextBanner = body.bannerImageUrl === undefined ? undefined : body.bannerImageUrl?.trim() || null;
  if (nextAvatar && nextAvatar !== user.avatar && !storedFileId(nextAvatar)) {
    return NextResponse.json({ error: "Avatar must come from an uploaded profile image" }, { status: 400 });
  }
  if (nextBanner && nextBanner !== user.bannerImageUrl && !storedFileId(nextBanner)) {
    return NextResponse.json({ error: "Banner must come from an uploaded profile image" }, { status: 400 });
  }

  const password = changingPassword ? await bcrypt.hash(body.newPassword!, 12) : undefined;
  const replacedFileIds: string[] = [];
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: {
        name?: string;
        avatar?: string | null;
        bannerImageUrl?: string | null;
        avatarFileId?: string | null;
        bannerFileId?: string | null;
        password?: string;
      } = {};
      if (name) updateData.name = name;
      if (password) updateData.password = password;

      if (nextAvatar !== undefined && nextAvatar !== user.avatar) {
        const nextId = nextAvatar ? storedFileId(nextAvatar) : null;
        if (nextId) await claimUploads(tx, [nextId], userId, "PROFILE_AVATAR");
        updateData.avatar = nextAvatar;
        updateData.avatarFileId = nextId;
        if (user.avatarFileId) replacedFileIds.push(user.avatarFileId);
      }
      if (nextBanner !== undefined && nextBanner !== user.bannerImageUrl) {
        const nextId = nextBanner ? storedFileId(nextBanner) : null;
        if (nextId) await claimUploads(tx, [nextId], userId, "PROFILE_BANNER");
        updateData.bannerImageUrl = nextBanner;
        updateData.bannerFileId = nextId;
        if (user.bannerFileId) replacedFileIds.push(user.bannerFileId);
      }

      await tx.user.update({ where: { id: userId }, data: updateData });
      await markFilesForDeletion(tx, replacedFileIds);
    });
  } catch (error) {
    if (error instanceof UploadClaimError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (replacedFileIds.length) await purgeStoredFiles(replacedFileIds);

  const updatedUser = await getCurrentUserById(userId);
  return NextResponse.json({ user: updatedUser });
}
