// Cross-tenant granted-query usage ledger (SK-EKP-008, EK-06 box 3).
//
// Data-layer tests against the real Miniflare D1 (migration 0028): the
// meter's one invariant is that it is idempotent under retry — a replay
// under the same (grant, key) records no second billable event. The
// per-grant scoping of that dedupe and the attribution tuple round-trip
// are pinned too. Live per-query emission from the granted `/v1/ask` route
// lands with box 2's executor wiring; this is the primitive it will call.

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { recordGrantUsage } from "../src/grant-usage.ts";

const GRANT = "grant-1";
const OWNER = "tenant-owner";
const GRANTEE = "tenant-grantee";

function emit(overrides: Partial<Parameters<typeof recordGrantUsage>[1]> = {}) {
  return recordGrantUsage(env.DB, {
    grantId: GRANT,
    ownerTenantId: OWNER,
    ownerDbId: "db-1",
    granteeTenantId: GRANTEE,
    idempotencyKey: "idem-a",
    ...overrides,
  });
}

async function countUsage(grantId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM grant_usage WHERE grant_id = ?")
    .bind(grantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe("grant usage ledger (D1)", () => {
  it("emits one record for a successful granted query and round-trips its attribution", async () => {
    const grantId = "grant-attr";
    const out = await emit({ grantId, idempotencyKey: "k1" });
    expect(out).toEqual({ recorded: true });

    const row = await env.DB.prepare(
      "SELECT grant_id, owner_tenant_id, owner_db_id, grantee_tenant_id, idempotency_key " +
        "FROM grant_usage WHERE grant_id = ?",
    )
      .bind(grantId)
      .first<Record<string, string>>();
    expect(row).toMatchObject({
      grant_id: grantId,
      owner_tenant_id: OWNER,
      owner_db_id: "db-1",
      grantee_tenant_id: GRANTEE,
      idempotency_key: "k1",
    });
  });

  it("is idempotent under retry — a replay of the same key records no second event", async () => {
    const grantId = "grant-replay";
    // SK-EKP-008 (hardened 2026-08-07): same key ⇒ no second usage record.
    expect(await emit({ grantId, idempotencyKey: "same" })).toEqual({ recorded: true });
    expect(await emit({ grantId, idempotencyKey: "same" })).toEqual({ recorded: false });
    expect(await emit({ grantId, idempotencyKey: "same" })).toEqual({ recorded: false });
    expect(await countUsage(grantId)).toBe(1);
  });

  it("counts distinct keys under the same grant as distinct billable events", async () => {
    const grantId = "grant-distinct";
    expect(await emit({ grantId, idempotencyKey: "q1" })).toEqual({ recorded: true });
    expect(await emit({ grantId, idempotencyKey: "q2" })).toEqual({ recorded: true });
    expect(await countUsage(grantId)).toBe(2);
  });

  it("dedupes per-grant — the same key under two grants is two events", async () => {
    // The billing unit is attributable to a grant; a client key colliding
    // across two different grants must not swallow one seller's earnings.
    expect(await emit({ grantId: "grant-x", idempotencyKey: "shared" })).toEqual({
      recorded: true,
    });
    expect(await emit({ grantId: "grant-y", idempotencyKey: "shared" })).toEqual({
      recorded: true,
    });
    expect(await countUsage("grant-x")).toBe(1);
    expect(await countUsage("grant-y")).toBe(1);
  });
});
