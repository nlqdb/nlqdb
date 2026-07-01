// SK-ONBOARD-006 — first-10-queries success counters (GLOBAL-025
// onboarding KPI). The /v1/ask handler bumps these fire-and-forget;
// the load-bearing behaviour is the saturating UPDATE itself:
// `first10_asks` stops at 10, `first10_ok` counts only successful
// completions, and the tenant guard keeps a bump from crossing
// tenants. Exercised against real D1 (migration 0020).

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Must stay in sync with `bumpFirst10` in `apps/api/src/index.ts`.
const BUMP =
  "UPDATE databases SET first10_asks = first10_asks + 1, first10_ok = first10_ok + ? WHERE id = ? AND tenant_id = ? AND first10_asks < 10";

async function insertDb(id: string, tenantId: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO databases (id, tenant_id, connection_secret_ref) VALUES (?, ?, 'ref')",
  )
    .bind(id, tenantId)
    .run();
}

async function counters(id: string): Promise<unknown> {
  return env.DB.prepare("SELECT first10_asks, first10_ok FROM databases WHERE id = ?")
    .bind(id)
    .first();
}

describe("first-10-queries counters (migration 0020)", () => {
  it("counts outcomes and saturates at 10 asks", async () => {
    await insertDb("db_f10", "user_f10");
    // 9 successes, then 3 failures — the 11th and 12th bumps must
    // no-op on the `first10_asks < 10` guard.
    for (let i = 0; i < 9; i++) {
      await env.DB.prepare(BUMP).bind(1, "db_f10", "user_f10").run();
    }
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(BUMP).bind(0, "db_f10", "user_f10").run();
    }
    expect(await counters("db_f10")).toEqual({ first10_asks: 10, first10_ok: 9 });
  });

  it("never bumps across tenants", async () => {
    await insertDb("db_f10_b", "user_owner");
    await env.DB.prepare(BUMP).bind(1, "db_f10_b", "user_other").run();
    expect(await counters("db_f10_b")).toEqual({ first10_asks: 0, first10_ok: 0 });
  });
});
