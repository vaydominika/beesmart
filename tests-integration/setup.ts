import { afterAll, beforeAll } from "vitest";

function databaseName(value: string) {
  try {
    return new URL(value).pathname.replace(/^\//, "").toLowerCase();
  } catch {
    return "";
  }
}

beforeAll(() => {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (!databaseName(url).includes("test")) {
    throw new Error("Integration tests require TEST_DATABASE_URL or DATABASE_URL pointing to a database whose name contains 'test'.");
  }
  process.env.DATABASE_URL = url;
});

afterAll(async () => {
  const globalPrisma = (globalThis as { prisma?: { $disconnect?: () => Promise<void> } }).prisma;
  await globalPrisma?.$disconnect?.();
});
