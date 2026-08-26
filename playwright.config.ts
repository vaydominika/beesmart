import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  globalSetup: './tests-e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'html',
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    env: {
      ...process.env,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-secret-at-least-32-characters-long',
      AUTH_URL: process.env.AUTH_URL ?? 'http://localhost:3000',
      ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? 'admin@beesmart.test',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? 'test-key',
      E2E_TEST_MODE: 'true',
    },
  },
});
