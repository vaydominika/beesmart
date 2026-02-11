const globalForPrisma = globalThis as unknown as { prisma: unknown };

function createPrismaClient() {
  require("dotenv/config");
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Prisma 7 requires an adapter with a connection URL."
    );
  }
  const { PrismaClient: PrismaClientCtor } = require("./generated/prisma");
  const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
  const adapter = new PrismaMariaDb(url);
  return new PrismaClientCtor({ adapter });
}

function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma as ReturnType<typeof createPrismaClient>;
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy(
  {} as ReturnType<typeof createPrismaClient>,
  {
    get(_, prop) {
      return getPrisma()[prop as keyof ReturnType<typeof createPrismaClient>];
    },
  }
);

/**
 * Returns the current user id from the session. Used by API routes and server code.
 * Uses dynamic import to avoid circular dependency with auth (auth imports prisma from this file).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const id = session?.user?.id;
  return typeof id === "string" ? id : null;
}
