import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Two projects so iterating on a single unit-test file doesn't pay
// the Miniflare-boot cost (>30s of `setup` per file).
//
//   unit        — pure functions with stubbed deps. Runs in node.
//                 Files: orchestrate, plan-cache, sql-validate,
//                 middleware, first-query.
//   integration — needs real D1 / KV / SELF. Runs inside Workers
//                 runtime via Miniflare. Files: health, auth, ask,
//                 rate-limit.
//
// Total runtime today: 30-45s for the integration suite, 1-2s for
// units. Single-file vitest invocations short-circuit to one project.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(here, "migrations"));
  return {
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: [
              "test/orchestrate.test.ts",
              "test/plan-cache.test.ts",
              "test/sql-validate.test.ts",
              "test/middleware.test.ts",
              "test/first-query.test.ts",
            ],
          },
        },
        {
          extends: true,
          plugins: [
            cloudflareTest({
              // `main` makes the worker run in the same isolate as
              // the tests so vi.mock of modules imported by the
              // worker entrypoint propagates through SELF.fetch (per
              // Cloudflare docs). Worker-module mocking is still
              // partially broken upstream — `cloudflare/workers-sdk
              // #10201` — see auth.test.ts coverage trade-off.
              main: "./src/index.ts",
              singleWorker: true,
              isolatedStorage: true,
              wrangler: { configPath: "./wrangler.toml" },
              miniflare: {
                bindings: {
                  NODE_ENV: "test",
                  BETTER_AUTH_SECRET:
                    "test-better-auth-secret-placeholder-please-do-not-use-in-prod",
                  OAUTH_GITHUB_CLIENT_ID: "test-gh-prod-id",
                  OAUTH_GITHUB_CLIENT_SECRET: "test-gh-prod-secret",
                  OAUTH_GITHUB_CLIENT_ID_DEV: "test-gh-dev-id",
                  OAUTH_GITHUB_CLIENT_SECRET_DEV: "test-gh-dev-secret",
                  GOOGLE_CLIENT_ID: "test-google-id",
                  GOOGLE_CLIENT_SECRET: "test-google-secret",
                  TEST_MIGRATIONS: migrations,
                },
              },
            }),
          ],
          test: {
            name: "integration",
            include: [
              "test/health.test.ts",
              "test/auth.test.ts",
              "test/ask.test.ts",
              "test/rate-limit.test.ts",
            ],
            setupFiles: ["./test/apply-migrations.ts"],
          },
        },
      ],
    },
  };
});
