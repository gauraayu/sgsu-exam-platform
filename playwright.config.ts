import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DB = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/sgsu_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "test-results/e2e-results.json" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--no-sandbox"],
    },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MONGODB_URI: E2E_DB, APP_URL: `http://localhost:${PORT}`, CRON_SECRET: "e2e-cron", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789", NODE_ENV: "production" },
  },
});
