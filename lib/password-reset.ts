import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_PREFIX = "password-reset:";
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetIdentifier(userId: string) {
  return `${PASSWORD_RESET_PREFIX}${userId}`;
}

export function passwordResetUrl(token: string) {
  const baseUrl = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!baseUrl) throw new Error("AUTH_URL is required to create password reset links");
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
