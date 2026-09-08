import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendEmailVerificationEmail } from "@/lib/email";
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_MS,
  emailVerificationIdentifier,
  emailVerificationUrl,
  hashEmailVerificationToken,
} from "@/lib/email-verification";
import { consumeRateLimit, rateLimitHeaders, requestClientAddress } from "@/lib/security/rate-limit";

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, email address, and password of at least 12 characters" },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  const addressLimit = await consumeRateLimit(
    "auth-register-address",
    requestClientAddress(request.headers),
    { limit: 5, windowMs: 60 * 60_000 },
  );
  const emailLimit = await consumeRateLimit(
    "auth-register-email",
    email,
    { limit: 3, windowMs: 60 * 60_000 },
  );
  if (!addressLimit.allowed || !emailLimit.allowed) {
    const limit = !addressLimit.allowed ? addressLimit : emailLimit;
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Unable to create an account with these details" },
      { status: 400 },
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationToken = createEmailVerificationToken();
  const verificationTokenHash = hashEmailVerificationToken(verificationToken);
  const verificationUrl = emailVerificationUrl(verificationToken);
  let userId: string;

  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashedPassword },
        select: { id: true },
      });
      await tx.verificationToken.create({
        data: {
          identifier: emailVerificationIdentifier(user.id),
          token: verificationTokenHash,
          expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });
      return user.id;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Unable to create an account with these details" }, { status: 400 });
    }
    throw error;
  }

  try {
    await sendEmailVerificationEmail({
      to: email,
      verificationUrl,
      idempotencyKey: verificationTokenHash,
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { identifier: emailVerificationIdentifier(userId) } }),
      prisma.user.deleteMany({ where: { id: userId, emailVerified: null } }),
    ]);
    console.error("Registration verification email delivery failed", error);
    return NextResponse.json(
      { error: "Unable to send the verification email. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, verificationRequired: true }, { status: 201 });
}
