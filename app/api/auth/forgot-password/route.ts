import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetIdentifier,
  passwordResetUrl,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";
import { consumeRateLimit, rateLimitHeaders, requestClientAddress } from "@/lib/security/rate-limit";

const requestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const genericMessage = "If an account exists for that email, a reset link has been sent.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const email = parsed.data.email;
  const [addressLimit, emailLimit] = await Promise.all([
    consumeRateLimit("password-reset-address", requestClientAddress(request.headers), { limit: 10, windowMs: 15 * 60_000 }),
    consumeRateLimit("password-reset-email", email, { limit: 3, windowMs: 15 * 60_000 }),
  ]);
  if (!addressLimit.allowed || !emailLimit.allowed) {
    const limit = !addressLimit.allowed ? addressLimit : emailLimit;
    return NextResponse.json({ error: "Too many reset requests. Try again later." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ message: genericMessage });

  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const identifier = passwordResetIdentifier(user.id);
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({ data: { identifier, token: tokenHash, expires } }),
  ]);

  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl: passwordResetUrl(token), idempotencyKey: tokenHash });
  } catch (error) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } });
    console.error("Password reset email delivery failed", error);
  }

  return NextResponse.json({ message: genericMessage });
}
