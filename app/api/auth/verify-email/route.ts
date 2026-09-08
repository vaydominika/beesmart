import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  EMAIL_VERIFICATION_PREFIX,
  hashEmailVerificationToken,
} from "@/lib/email-verification";

function loginRedirect(request: Request, result: "verified" | "invalid") {
  const url = new URL("/login", request.url);
  url.searchParams.set("verification", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length > 512) return loginRedirect(request, "invalid");

  const tokenHash = hashEmailVerificationToken(token);
  const record = await prisma.verificationToken.findFirst({
    where: {
      token: tokenHash,
      identifier: { startsWith: EMAIL_VERIFICATION_PREFIX },
      expires: { gt: new Date() },
    },
  });
  if (!record) return loginRedirect(request, "invalid");

  const userId = record.identifier.slice(EMAIL_VERIFICATION_PREFIX.length);
  const verified = await prisma.$transaction(async (tx) => {
    const consumed = await tx.verificationToken.deleteMany({
      where: {
        identifier: record.identifier,
        token: tokenHash,
        expires: { gt: new Date() },
      },
    });
    if (consumed.count !== 1) return false;

    const updated = await tx.user.updateMany({
      where: { id: userId, emailVerified: null },
      data: { emailVerified: new Date() },
    });
    await tx.verificationToken.deleteMany({ where: { identifier: record.identifier } });
    return updated.count === 1;
  });

  return loginRedirect(request, verified ? "verified" : "invalid");
}
