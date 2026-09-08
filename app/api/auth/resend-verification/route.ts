import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email";
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_MS,
  emailVerificationIdentifier,
  emailVerificationUrl,
  hashEmailVerificationToken,
} from "@/lib/email-verification";
import { consumeRateLimit, rateLimitHeaders, requestClientAddress } from "@/lib/security/rate-limit";

const requestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const genericMessage = "If this account needs verification, a new link has been sent.";

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
    consumeRateLimit("email-verification-address", requestClientAddress(request.headers), { limit: 10, windowMs: 15 * 60_000 }),
    consumeRateLimit("email-verification-email", email, { limit: 3, windowMs: 15 * 60_000 }),
  ]);
  if (!addressLimit.allowed || !emailLimit.allowed) {
    const limit = !addressLimit.allowed ? addressLimit : emailLimit;
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, emailVerified: true },
  });
  if (!user?.password || user.emailVerified) return NextResponse.json({ message: genericMessage });

  const token = createEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(token);
  const identifier = emailVerificationIdentifier(user.id);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: tokenHash,
        expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    }),
  ]);

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      verificationUrl: emailVerificationUrl(token),
      idempotencyKey: tokenHash,
    });
  } catch (error) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } });
    console.error("Verification email resend failed", error);
  }

  return NextResponse.json({ message: genericMessage });
}
