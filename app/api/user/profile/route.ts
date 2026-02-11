import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, getCurrentUserId } from "@/lib/db";
import { getCurrentUserById } from "@/lib/courses-data";

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

  const updatedUser = await getCurrentUserById(userId);
  return NextResponse.json({ user: updatedUser });
}
