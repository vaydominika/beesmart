import { cleanupStoredFiles } from "../lib/files/lifecycle";
import { prisma } from "../lib/db";
import { cleanupExpiredRateLimits } from "../lib/security/rate-limit";

const limit = Math.max(1, Math.min(1000, Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 100)));

try {
  const processed = await cleanupStoredFiles(limit);
  const expiredRateLimits = await cleanupExpiredRateLimits();
  console.log(JSON.stringify({ event: "maintenance_cleanup_complete", processedFiles: processed, expiredRateLimits: expiredRateLimits.count }));
} finally {
  await prisma.$disconnect();
}
