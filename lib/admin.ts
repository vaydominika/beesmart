import { prisma } from "@/lib/db";

export function configuredAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined, value = process.env.ADMIN_EMAILS) {
  if (!email) return false;
  return configuredAdminEmails(value).has(email.trim().toLowerCase());
}

export async function hasAdminAccess() {
  const { auth } = await import("@/auth");
  const session = await auth();
  return isAdminEmail(session?.user?.email);
}

export async function isAdminUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isAdminEmail(user?.email);
}
