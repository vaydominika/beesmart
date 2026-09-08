import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { passwordCredentialsStatus } from "@/lib/password-credentials";
import { consumeRateLimit, rateLimitHeaders, requestClientAddress } from "@/lib/security/rate-limit";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ pending: false });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ pending: false });

  const { email, password } = parsed.data;
  const limit = await consumeRateLimit(
    "auth-pending-verification",
    `${requestClientAddress(request.headers)}:${email}`,
    { limit: 10, windowMs: 15 * 60_000 },
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { pending: false },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { password: true, emailVerified: true },
  });
  const status = await passwordCredentialsStatus(user, password);
  return NextResponse.json({ pending: status === "unverified" });
}
