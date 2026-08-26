import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    maxWorkers: 4,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    setupFiles: ["./vitest.setup.tsx"],
    include: ["**/*.test.{ts,tsx}"],
    alias: {
      "@": path.resolve(configDirectory, "./"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 50,
        branches: 45,
        functions: 50,
        lines: 55,
      },
      exclude: [
        "node_modules/**",
        ".next/**",
        "out/**",
        "public/**",
        "lib/generated/**",
        "**/*.d.ts",
        "**/*.config.*",
        "tests-e2e/**",
        "tests-integration/**",
        "test-utils/**",
      ],
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "tests-e2e/**",
      "tests-integration/**",
    ],
  },
});
