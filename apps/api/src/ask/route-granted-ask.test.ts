// Granted-read route-branch tests (SK-EKP-008, EK-06 box 2 — the `/v1/ask`
// wiring). Two layers:
//   1. `renderGrantedAsk` — the pure, exhaustive map from the result union to an
//      HTTP render. Every reject reason has one render; the trust-load-bearing
//      cases are (a) `no_grant` → `fallthrough` (fail-closed: a non-grantee gets
//      the handler's plain `db_not_found`, never a "grant exists" signal) and
//      (b) rows-only success (no `summary` seam — GLOBAL-037 / EK-09 box 2).
//   2. `tryGrantedRead` — drives the REAL `orchestrateGrantedAsk` over fake I/O
//      (the `grant-ask.test.ts` idiom), proving the branch renders live rows and
//      passes a scope reject through as a 403.

import { describe, expect, it, vi } from "vitest";
import type { GrantedReadIo } from "../grant-orchestrate.ts";
import type { GrantRecord } from "../grants.ts";
import { renderGrantedAsk, tryGrantedRead } from "./route-granted-ask.ts";
import type { DbRecord, QueryResult } from "./types.ts";

describe("renderGrantedAsk — pure union → HTTP render", () => {
  const rows = [{ id: 1 }, { id: 2 }];

  it("rows-only 200 on success, with no summary seam", () => {
    const render = renderGrantedAsk({
      ok: true,
      rows,
      rowCount: 2,
      grant: {} as GrantRecord,
      tables: ["lessons"],
      idempotencyKey: "k1",
      usageRecorded: true,
    });
    expect(render).toEqual({
      served: "rows",
      status: 200,
      body: { granted: true, rows, row_count: 2 },
    });
    // No prose/summary field a caller could narrate through.
    expect(render.served === "rows" && "summary" in render.body).toBe(false);
  });

  it("no_grant falls through to the handler's plain db_not_found (fail-closed)", () => {
    expect(renderGrantedAsk({ ok: false, reason: "no_grant" })).toEqual({ served: "fallthrough" });
  });

  it("owner_db_missing → 404 grant_target_unavailable", () => {
    expect(renderGrantedAsk({ ok: false, reason: "owner_db_missing" })).toEqual({
      served: "error",
      status: 404,
      body: { error: "grant_target_unavailable" },
    });
  });

  it("not_grantable → 409 grant_not_supported", () => {
    expect(renderGrantedAsk({ ok: false, reason: "not_grantable" })).toEqual({
      served: "error",
      status: 409,
      body: { error: "grant_not_supported" },
    });
  });

  it("schema_unavailable → 409 schema_unavailable", () => {
    expect(renderGrantedAsk({ ok: false, reason: "schema_unavailable" })).toEqual({
      served: "error",
      status: 409,
      body: { error: "schema_unavailable" },
    });
  });

  it("out_of_scope → 403 grant_scope_denied, carrying the offending table", () => {
    expect(renderGrantedAsk({ ok: false, reason: "out_of_scope", detail: "pricing" })).toEqual({
      served: "error",
      status: 403,
      body: { error: "grant_scope_denied", reason: "out_of_scope", detail: "pricing" },
    });
  });

  it("not_read_only / not_allowed → 403 grant_scope_denied (detail omitted when absent)", () => {
    expect(renderGrantedAsk({ ok: false, reason: "not_read_only" })).toEqual({
      served: "error",
      status: 403,
      body: { error: "grant_scope_denied", reason: "not_read_only" },
    });
    expect(
      renderGrantedAsk({ ok: false, reason: "not_allowed", detail: "multi_statement" }),
    ).toEqual({
      served: "error",
      status: 403,
      body: { error: "grant_scope_denied", reason: "not_allowed", detail: "multi_statement" },
    });
  });
});

// --- tryGrantedRead over the real orchestrator + fake I/O (grant-ask.test.ts idiom).

const BUYER = "user_buyer_2";
const OWNER = "user_owner_1";
const OWNER_DB_ID = "db_lang_tutor_1";
const OWNER_SCHEMA = "lang_tutor_1";
const OWNER_SCHEMA_TEXT = "CREATE TABLE lessons (id int); CREATE TABLE students (id int)";

const GRANT: GrantRecord = {
  id: "11111111-2222-3333-4444-555555555555",
  ownerTenantId: OWNER,
  ownerDbId: OWNER_DB_ID,
  granteeTenantId: BUYER,
  scope: ["lessons", "students"],
  priceModel: null,
  createdAt: 1_700_000_000,
  revokedAt: null,
};

const HOSTED_OWNER_DB: DbRecord = {
  id: OWNER_DB_ID,
  tenantId: OWNER,
  engine: "postgres",
  connectionSecretRef: "NEON_URL",
  schemaHash: "hash_0",
  schemaText: OWNER_SCHEMA_TEXT,
  connectionBlob: null,
};

const ROWS: QueryResult = { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 };

function makeIo(over: Partial<GrantedReadIo> = {}): GrantedReadIo {
  return {
    resolveActiveGrant: vi.fn(async () => GRANT as GrantRecord | null),
    resolveOwnerDb: vi.fn(async () => HOSTED_OWNER_DB as DbRecord | null),
    runExecSteps: vi.fn(async () => ROWS),
    recordUsage: vi.fn(async () => ({ recorded: true })),
    newIdempotencyKey: vi.fn(() => "synth-key-abc"),
    ...over,
  };
}

function run(io: GrantedReadIo, planReadSql: (goal: string, schema: string) => Promise<string>) {
  return tryGrantedRead(
    { buyerTenantId: BUYER, requestedDbId: OWNER_DB_ID, goal: "count lessons" },
    { io, planReadSql },
  );
}

describe("tryGrantedRead — real orchestrator over fake I/O", () => {
  it("renders live owner rows as a rows-only 200", async () => {
    const render = await run(
      makeIo(),
      vi.fn(async () => `SELECT * FROM ${OWNER_SCHEMA}.lessons`),
    );
    expect(render).toEqual({
      served: "rows",
      status: 200,
      body: { granted: true, rows: ROWS.rows, row_count: 2 },
    });
  });

  it("no live grant renders fallthrough (handler keeps its db_not_found)", async () => {
    const io = makeIo({ resolveActiveGrant: vi.fn(async () => null) });
    expect(
      await run(
        io,
        vi.fn(async () => "SELECT 1"),
      ),
    ).toEqual({ served: "fallthrough" });
  });

  it("a plan reaching outside scope renders a 403 grant_scope_denied", async () => {
    // `pricing` is outside the grant's [lessons, students] scope.
    const render = await run(
      makeIo(),
      vi.fn(async () => "SELECT * FROM pricing"),
    );
    expect(render).toEqual({
      served: "error",
      status: 403,
      body: { error: "grant_scope_denied", reason: "out_of_scope", detail: "pricing" },
    });
  });
});
