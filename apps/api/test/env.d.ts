// Test-only env augmentation. The `cloudflare:test` virtual module's
// `env` is typed as `ProvidedEnv`; we extend it with our production
// bindings + the `TEST_MIGRATIONS` array fed in via `vitest.config.ts`.

import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Cloudflare.Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
