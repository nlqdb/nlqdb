import type { PlaywrightTestConfig } from "@playwright/test";

// Importing `devices` from `@playwright/test` trips the CJS↔ESM
// interop on Node 22; the hardcoded `browserName` is the part of
// `devices["Desktop Chrome"]` we actually use.
const config: PlaywrightTestConfig = {
  testDir: "../../../examples",
  testMatch: "**/e2e/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"]
    ? [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]]
    : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    browserName: "chromium",
  },
  projects: [{ name: "chromium" }],
};

export default config;
