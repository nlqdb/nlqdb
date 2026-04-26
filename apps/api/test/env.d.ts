// Test-only env augmentation. `cloudflare:test`'s `env` is typed as
// `Cloudflare.Env`, so we extend that global interface with the
// test-injected `TEST_MIGRATIONS` from `vitest.config.ts`. Marked
// optional so production code can't accidentally rely on it.

import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS?: D1Migration[];
    }
  }
}
