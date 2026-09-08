import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_PREFIX = "email-verification:";
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function createEmailVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function emailVerificationIdentifier(userId: string) {
  return `${EMAIL_VERIFICATION_PREFIX}${userId}`;
}

export function emailVerificationUrl(token: string) {
  const baseUrl = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!baseUrl) throw new Error("AUTH_URL is required to create email verification links");
  const url = new URL("/api/auth/verify-email", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
