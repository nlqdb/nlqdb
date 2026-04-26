import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Tests run inside the Workers runtime (Miniflare) so D1 + KV behave
// like production. `wrangler.toml` supplies KV/D1 bindings; the
// `bindings` block below overrides `[vars] NODE_ENV` and supplies
// placeholder secrets — Better Auth stores them as strings at module
// load without validation, so real OAuth round-trips never fire here.
//
// Pool API note (vitest 4 + @cloudflare/vitest-pool-workers ≥0.13):
// the older `defineWorkersProject` helper was replaced by the
// `cloudflareTest()` Vite plugin. Same options shape, different entry.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(here, "migrations"));
  return {
    plugins: [
      cloudflareTest({
        // `main` makes the worker run in the same isolate as the tests
        // so `vi.mock(...)` of modules imported by the worker
        // entrypoint propagates to SELF.fetch (per Cloudflare docs:
        // "main Worker runs in the same isolate/context as tests so
        // any global mocks will apply to it too").
        main: "./src/index.ts",
        singleWorker: true,
        isolatedStorage: true,
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            NODE_ENV: "test",
            BETTER_AUTH_SECRET: "test-better-auth-secret-placeholder-please-do-not-use-in-prod",
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
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
