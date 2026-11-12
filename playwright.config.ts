import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser", testMatch: "**/*.spec.ts", fullyParallel: false,
  timeout: 30_000, retries: 0, workers: 1,
  outputDir: "test-results/ux", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4178", browserName: "chromium", headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] },
    screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npx vite --config vite.ux.config.ts", url: "http://127.0.0.1:4178", reuseExistingServer: false },
});
