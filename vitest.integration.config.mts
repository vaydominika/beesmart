import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests-integration/**/*.integration.test.ts"],
    setupFiles: ["./tests-integration/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    alias: {
      "@": path.resolve(configDirectory, "./"),
    },
  },
});
