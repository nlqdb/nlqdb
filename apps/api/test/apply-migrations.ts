// Apply D1 migrations to Miniflare's per-test-file fresh DB. Runs once
// per test file (isolatedStorage = true in vitest.config.ts), so every
// test starts against a known schema with no row-level state from
// other files.

import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  if (!env.TEST_MIGRATIONS) {
    throw new Error(
      "TEST_MIGRATIONS not bound — check vitest.config.ts cloudflareTest({ miniflare.bindings })",
    );
  }
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
