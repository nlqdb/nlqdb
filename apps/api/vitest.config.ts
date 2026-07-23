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
          resolve: {
            alias: {
              "libpg-query/wasm/libpg-query.wasm": path.resolve(
                here,
                "test/libpg-query-wasm-shim.ts",
              ),
            },
          },
          test: {
            name: "unit",
            include: [
              "test/http.test.ts",
              "test/byollm.test.ts",
              "test/secret-envelope.test.ts",
              "test/orchestrate.test.ts",
              "test/plan-normalize.test.ts",
              "test/diag.test.ts",
              "test/plan-cache.test.ts",
              "test/sql-validate.test.ts",
              "test/middleware.test.ts",
              "test/principal.test.ts",
              "test/api-keys.test.ts",
              "test/turnstile.test.ts",
              "test/anon-rate-limit.test.ts",
              "test/anon-create-gate.test.ts",
              "test/anon-global-cap.test.ts",
              "test/first-query.test.ts",
              "test/stripe-webhook.test.ts",
              "test/stripe-checkout.test.ts",
              "test/stripe-portal.test.ts",
              "test/billing-status.test.ts",
              "test/chat-orchestrate.test.ts",
              "test/email.test.ts",
              "test/demo.test.ts",
              "test/chat-demo-shortcut.test.ts",
              "test/icp-scrape.test.ts",
              "test/icp-score.test.ts",
              "test/icp-cluster.test.ts",
              "test/kv-throttle.test.ts",
              "test/anon-adopt.test.ts",
              "test/anon-stash.test.ts",
              "test/databases-list.test.ts",
              "test/db-sweep.test.ts",
              "test/events-feature.test.ts",
              "test/mock-email-sink.test.ts",
              "test/oauth-mcp-bridge.test.ts",
              "test/workload-analyser/*.test.ts",
              "src/admin/gate.test.ts",
              "src/synthetic-ua.test.ts",
              "src/https-enforce.test.ts",
              "src/marketing-mirror.test.ts",
              "src/databases/list.test.ts",
              "src/db-connect/connect.test.ts",
              "src/db-create/**/*.test.ts",
              "src/ask/sql-validate-ddl.test.ts",
              "src/ask/route-ask.test.ts",
              "src/ask/prelude.test.ts",
              "src/ask/recent-tables.test.ts",
              "src/ask/retry.test.ts",
              "src/ask/diff.test.ts",
              "src/ask/demand-signal.test.ts",
              "src/ask/frontier-router.test.ts",
              "src/run/orchestrate.test.ts",
              "src/memory/remember.test.ts",
              "src/memory/expire.test.ts",
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
              "test/cors.test.ts",
              "test/rate-limit.test.ts",
              "test/magic-link.test.ts",
              "test/errors-web.test.ts",
              "test/keys-mint.test.ts",
              "test/byollm-account.test.ts",
              "test/byollm-endpoints.test.ts",
              "test/premium-interest.test.ts",
              "test/pmf-survey.test.ts",
              "test/models.test.ts",
              "test/databases-delete.test.ts",
              "test/db-connect.test.ts",
              "test/ask-dispatch.test.ts",
              "test/exec-acl-heal.test.ts",
              "test/first10.test.ts",
              "test/run.test.ts",
              "test/admin-metrics.test.ts",
            ],
            setupFiles: ["./test/apply-migrations.ts"],
          },
        },
      ],
    },
  };
});
