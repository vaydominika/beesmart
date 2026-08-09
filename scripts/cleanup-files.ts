import { cleanupStoredFiles } from "../lib/files/lifecycle";
import { prisma } from "../lib/db";

const limit = Math.max(1, Math.min(1000, Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 100)));

try {
  const processed = await cleanupStoredFiles(limit);
  console.log(JSON.stringify({ event: "file_cleanup_complete", processed }));
} finally {
  await prisma.$disconnect();
}
