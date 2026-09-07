import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPasswordResetToken, PASSWORD_RESET_PREFIX } from "@/lib/password-reset";
import { consumeRateLimit, rateLimitHeaders, requestClientAddress } from "@/lib/security/rate-limit";

const resetSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("password-reset-submit", requestClientAddress(request.headers), { limit: 10, windowMs: 15 * 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Use a valid reset link and a password between 12 and 128 characters" }, { status: 400 });
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const record = await prisma.verificationToken.findFirst({
    where: { token: tokenHash, identifier: { startsWith: PASSWORD_RESET_PREFIX }, expires: { gt: new Date() } },
  });
  if (!record) return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });

  const userId = record.identifier.slice(PASSWORD_RESET_PREFIX.length);
  const password = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.deleteMany({ where: { identifier: record.identifier, token: tokenHash, expires: { gt: new Date() } } });
      if (consumed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
      await tx.user.update({ where: { id: userId }, data: { password } });
      await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_ALREADY_USED") {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ message: "Password updated. You can now sign in." });
}
