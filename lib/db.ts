import "dotenv/config";
import { PrismaClient } from "./generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Prisma 7 requires an adapter with a connection URL."
    );
  }
  const adapter = new PrismaMariaDb(url);
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Returns the current user id for the app. Replace with session when auth is added.
 * Uses CURRENT_USER_ID env (server) or first user in DB.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const envId = process.env.CURRENT_USER_ID;
  if (envId) return envId;
  const first = await prisma.user.findFirst({ select: { id: true } });
  return first?.id ?? null;
}
