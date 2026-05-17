import type { PlaywrightTestConfig } from "@playwright/test";

// One Playwright config for every example. Specs live under
// examples/<framework>/e2e/; the `testDir` here is the repo's examples
// folder so all per-example specs are discovered. Tag conventions:
//   @html, @nextjs, @nuxt, @sveltekit, @astro
// `--grep @<tag>` filters to one framework. (Shell smokes for `curl`
// and `cli` live under examples/*/e2e/smoke.sh — not run via Playwright.)
//
// We deliberately do NOT `import { devices }` here — that runtime
// import trips the CJS↔ESM interop on Node 22 (devices/defineConfig
// are stitched onto Playwright's CJS module via Object.assign, which
// cjs-module-lexer can't detect for static `export *` re-export from
// `@playwright/test`'s ESM shim). The hardcoded `browserName` below
// is what `devices["Desktop Chrome"]` materially expands to for our
// use; CI smoke tests don't need viewport / userAgent overrides.
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
