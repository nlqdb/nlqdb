// Route-level live usage-emission assertion (SK-EKP-008, EK-06 box 3).
//
// `test/grant-usage.test.ts` proves the METER PRIMITIVE against the real
// Miniflare D1 (migration 0028): a replay under the same (grant, key) records
// no second row, because the `UNIQUE (grant_id, idempotency_key)` constraint +
// `ON CONFLICT DO NOTHING` make idempotency structural. What that file could
// not yet prove — its own header says so — is that the WIRED granted `/v1/ask`
// route actually calls that primitive, exactly once per successful read, and
// replays idempotently at the route boundary. The route branch shipped
// 2026-08-27 (`route-granted-ask.ts` `tryGrantedRead`); `route-granted-ask.test.ts`
// drives it over a FAKE `recordUsage`, so the emission↔render↔replay contract
// against the real ledger is still unmeasured. This file closes that box.
//
// It drives the real route function through the PRODUCTION I/O wiring
// (`buildGrantedReadIo`) over the real `env.DB`: the grant lookup
// (`getActiveGrant`), the owner-DB resolve (`resolveDb`), and — the point — the
// usage emission (`recordGrantUsage`) all hit live D1 with real seeded `grants`
// + `databases` rows. The ONE injected seam is `runExecSteps`, the Neon
// owner-read: Miniflare has no Postgres, and that leg is already proven live by
// `grant-scoping.integration.test.ts` / `grant-revocation.integration.test.ts`.
// So the emission this file asserts is production's, not a fake's.
//
// Three route-boundary facts, tied to the real ledger:
//   1. A successful granted read renders rows-only 200 AND emits exactly one
//      usage row, correctly attributed, under the client's Idempotency-Key.
//   2. A retry under the same key renders the same rows-only 200 AND records no
//      second row — the DB constraint holds through the wired route.
//   3. A scope-rejected read renders 403 AND bills nothing (meter-after-success).

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { tryGrantedRead } from "../src/ask/route-granted-ask.ts";
import type { QueryResult } from "../src/ask/types.ts";
import { buildGrantedReadIo, type GrantStatusCache } from "../src/grant-ask-io.ts";
import { mintGrant } from "../src/grants.ts";

const BUYER = "tenant-buyer-route";
const OWNER = "tenant-owner-route";
const SCOPE = ["lessons", "students"];
// The owner's rows the injected Neon runner returns — un-narrated, exactly what
// a granted read serves. Row count is irrelevant to the billable unit (0 rows
// or 10 000 → one record); two rows keeps the render assertion concrete.
const ROWS: QueryResult = { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 };

// Pass-through status cache: the active-grant lookup hits real D1 every call
// (the ≤30 s bound is deterministically unit-measured in `grant-status.test.ts`;
// here we want the live read, not the cache).
const passthroughCache: GrantStatusCache = { status: (_key, lookup) => lookup() };

// The production I/O wiring over the real D1, with ONLY the Neon owner-read
// injected (canned rows). Everything the box asserts — grant lookup, owner-DB
// resolve, usage emission — runs against `env.DB`.
function routeIo() {
  return buildGrantedReadIo({
    d1: env.DB,
    statusCache: passthroughCache,
    runExecSteps: async () => ROWS,
  });
}

// A schema-only planner returning a bare, in-scope read — the owner's cell
// values never reach it (GLOBAL-037); `orchestrateGrantedAsk` strips it
// schema-relative before the scope guardrail sees it.
const planInScope = async () => "SELECT * FROM lessons";

// Seed a live grant + its hosted owner DB on a fresh owner-DB id, so each test's
// usage rows are isolated (isolatedStorage is per-file, not per-test). Returns
// the grant id the ledger attributes to.
async function seedGrant(ownerDbId: string): Promise<string> {
  await env.DB.prepare(
    "INSERT INTO databases (id, tenant_id, engine, connection_secret_ref, schema_hash, schema_text) " +
      "VALUES (?, ?, 'postgres', 'NEON_URL', 'hash_0', ?)",
  )
    .bind(ownerDbId, OWNER, "CREATE TABLE lessons (id int); CREATE TABLE students (id int)")
    .run();
  const grant = await mintGrant(env.DB, {
    ownerTenantId: OWNER,
    ownerDbId,
    granteeTenantId: BUYER,
    scope: SCOPE,
    priceModel: null,
  });
  return grant.id;
}

async function countUsage(grantId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM grant_usage WHERE grant_id = ?")
    .bind(grantId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const ROWS_200 = {
  served: "rows",
  status: 200,
  body: { granted: true, rows: ROWS.rows, row_count: 2 },
};

describe("granted /v1/ask route — live usage emission (EK-06 box 3)", () => {
  it("a successful granted read renders rows-only 200 and emits exactly one attributed usage row", async () => {
    const ownerDbId = "db_route_success";
    const grantId = await seedGrant(ownerDbId);

    const render = await tryGrantedRead(
      {
        buyerTenantId: BUYER,
        requestedDbId: ownerDbId,
        goal: "list lessons",
        idempotencyKey: "route-key-1",
      },
      { io: routeIo(), planReadSql: planInScope },
    );

    expect(render).toEqual(ROWS_200);

    const row = await env.DB.prepare(
      "SELECT grant_id, owner_tenant_id, owner_db_id, grantee_tenant_id, idempotency_key " +
        "FROM grant_usage WHERE grant_id = ?",
    )
      .bind(grantId)
      .first<Record<string, string>>();
    expect(row).toMatchObject({
      grant_id: grantId,
      owner_tenant_id: OWNER,
      owner_db_id: ownerDbId,
      grantee_tenant_id: BUYER,
      idempotency_key: "route-key-1",
    });
    expect(await countUsage(grantId)).toBe(1);
  });

  it("a retry under the same Idempotency-Key re-serves the rows and records no second event", async () => {
    const ownerDbId = "db_route_replay";
    const grantId = await seedGrant(ownerDbId);
    const input = {
      buyerTenantId: BUYER,
      requestedDbId: ownerDbId,
      goal: "list lessons",
      idempotencyKey: "route-replay-key",
    };
    const deps = { io: routeIo(), planReadSql: planInScope };

    // First query bills once; the retry returns the same rows-only 200 but the
    // grant_usage UNIQUE constraint (migration 0028) suppresses a second row —
    // the no-double-count invariant, measured through the wired route.
    expect(await tryGrantedRead(input, deps)).toEqual(ROWS_200);
    expect(await tryGrantedRead(input, deps)).toEqual(ROWS_200);
    expect(await countUsage(grantId)).toBe(1);
  });

  it("a scope-rejected granted read renders 403 and bills nothing (meter-after-success)", async () => {
    const ownerDbId = "db_route_denied";
    const grantId = await seedGrant(ownerDbId);

    const render = await tryGrantedRead(
      {
        buyerTenantId: BUYER,
        requestedDbId: ownerDbId,
        goal: "read pricing",
        idempotencyKey: "route-denied-key",
      },
      // `pricing` is outside the grant's [lessons, students] scope.
      { io: routeIo(), planReadSql: async () => "SELECT * FROM pricing" },
    );

    expect(render).toEqual({
      served: "error",
      status: 403,
      body: { error: "grant_scope_denied", reason: "out_of_scope", detail: "pricing" },
    });
    // A rejected read never touches the owner DB and never bills (SK-EKP-008).
    expect(await countUsage(grantId)).toBe(0);
  });
});
