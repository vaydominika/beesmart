import { chromium, type FullConfig } from "@playwright/test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { TEST_IDENTITIES, TEST_PASSWORD } from "@/test-utils/factories";
import { AUTH_STATE_DIR, authStatePath } from "./auth-state";

const execFileAsync = promisify(execFile);

export default async function globalSetup(config: FullConfig) {
  await execFileAsync(process.execPath, ["--import", "tsx", "scripts/seed-test-data.ts"], {
    cwd: process.cwd(),
    env: process.env,
  });
  await fs.mkdir(AUTH_STATE_DIR, { recursive: true });

  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required for authentication setup.");

  const browser = await chromium.launch();
  try {
    for (const role of Object.keys(TEST_IDENTITIES) as Array<keyof typeof TEST_IDENTITIES>) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email address").fill(TEST_IDENTITIES[role].email);
      await page.getByLabel("Password").fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/, { waitUntil: "commit" });
      await context.storageState({ path: authStatePath(role) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
