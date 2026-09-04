// SK-ONBOARD-006 + SK-GTM-011 — the per-DB ask counters the /v1/ask
// handler bumps fire-and-forget in one UPDATE. The load-bearing
// behaviour: `first10_asks`/`first10_ok` saturate at 10 (the onboarding
// KPI's ordinal), while `asks_total`/`asks_mcp` keep counting past 10 so
// SK-PIVOT-016 criterion 1 ("≥ 100 real public-MCP asks") is countable;
// `asks_mcp` bumps only for the public-MCP surface; the tenant guard
// keeps a bump from crossing tenants. Exercised against real D1
// (migrations 0020 + 0034).

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Must stay in sync with `bumpAskCounters` in `apps/api/src/index.ts`.
// Binds: [asks_mcp delta (0/1), first10_ok delta (0/1), id, tenant_id].
const BUMP =
  "UPDATE databases SET asks_total = asks_total + 1, asks_mcp = asks_mcp + ?, first10_ok = first10_ok + (CASE WHEN first10_asks < 10 THEN ? ELSE 0 END), first10_asks = first10_asks + (CASE WHEN first10_asks < 10 THEN 1 ELSE 0 END) WHERE id = ? AND tenant_id = ?";

async function insertDb(id: string, tenantId: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO databases (id, tenant_id, connection_secret_ref) VALUES (?, ?, 'ref')",
  )
    .bind(id, tenantId)
    .run();
}

async function counters(id: string): Promise<unknown> {
  return env.DB.prepare(
    "SELECT first10_asks, first10_ok, asks_total, asks_mcp FROM databases WHERE id = ?",
  )
    .bind(id)
    .first();
}

describe("per-DB ask counters (migrations 0020 + 0034)", () => {
  it("saturates first-10 at 10 but keeps asks_total counting past it", async () => {
    await insertDb("db_f10", "user_f10");
    // 9 successes, then 3 failures — the 11th and 12th bumps must no-op
    // the first-10 CASE but still advance the non-saturating totals.
    for (let i = 0; i < 9; i++) {
      await env.DB.prepare(BUMP).bind(0, 1, "db_f10", "user_f10").run();
    }
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(BUMP).bind(0, 0, "db_f10", "user_f10").run();
    }
    expect(await counters("db_f10")).toEqual({
      first10_asks: 10,
      first10_ok: 9,
      asks_total: 12,
      asks_mcp: 0,
    });
  });

  it("bumps asks_mcp only for the public-MCP surface", async () => {
    await insertDb("db_mcp", "user_mcp");
    // 3 via MCP (mcp delta = 1), 2 via another surface (mcp delta = 0).
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(BUMP).bind(1, 1, "db_mcp", "user_mcp").run();
    }
    for (let i = 0; i < 2; i++) {
      await env.DB.prepare(BUMP).bind(0, 1, "db_mcp", "user_mcp").run();
    }
    expect(await counters("db_mcp")).toEqual({
      first10_asks: 5,
      first10_ok: 5,
      asks_total: 5,
      asks_mcp: 3,
    });
  });

  it("never bumps across tenants", async () => {
    await insertDb("db_f10_b", "user_owner");
    await env.DB.prepare(BUMP).bind(1, 1, "db_f10_b", "user_other").run();
    expect(await counters("db_f10_b")).toEqual({
      first10_asks: 0,
      first10_ok: 0,
      asks_total: 0,
      asks_mcp: 0,
    });
  });
});
