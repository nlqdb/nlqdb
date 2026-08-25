// Granted-read EXECUTOR tests (SK-EKP-008, EK-06 box 2 — sub-piece (g)).
// `executeGrantedRead` composes the whole buyer-query flow: resolve → plan →
// run → meter → rows. These pin the three load-bearing contracts without a live
// DB: (1) every resolve/plan reject fails closed BEFORE any exec runs and
// BEFORE any usage is metered; (2) usage is metered ONLY after a successful
// exec, with the client's idempotency key or a synthesized one, and a replay
// (constraint conflict) records nothing new while the read still returns; (3)
// the result is rows-only — no prose seam — so cell values never reach
// narration. The live "owner rows, nothing else" + revoke-in-flight proof stays
// the route-wiring run's job (`grant-scoping.integration.test.ts`).

import { describe, expect, it, vi } from "vitest";
import type { DbRecord, QueryResult } from "./ask/types.ts";
import { executeGrantedRead, type GrantedReadIo } from "./grant-orchestrate.ts";
import { grantRoleName } from "./grant-role.ts";
import { GRANT_STATEMENT_TIMEOUT } from "./grant-status.ts";
import type { GrantRecord } from "./grants.ts";

const BUYER = "user_buyer_2";
const OWNER = "user_owner_1";
const OWNER_DB_ID = "db_lang_tutor_1";

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
  schemaText: "CREATE TABLE lessons (...)",
  connectionBlob: null,
};

const ROWS: QueryResult = { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 };

// Build the injected I/O with per-test overrides. Defaults are the happy path:
// a live grant on a hosted owner DB, a successful exec, and a fresh usage
// record under a fixed synthesized key.
function makeIo(over: Partial<GrantedReadIo> = {}): {
  io: GrantedReadIo;
  resolveActiveGrant: ReturnType<typeof vi.fn>;
  resolveOwnerDb: ReturnType<typeof vi.fn>;
  runExecSteps: ReturnType<typeof vi.fn>;
  recordUsage: ReturnType<typeof vi.fn>;
} {
  const resolveActiveGrant = vi.fn(async () => GRANT as GrantRecord | null);
  const resolveOwnerDb = vi.fn(async () => HOSTED_OWNER_DB as DbRecord | null);
  const runExecSteps = vi.fn(async () => ROWS);
  const recordUsage = vi.fn(async () => ({ recorded: true }));
  const newIdempotencyKey = vi.fn(() => "synth-key-abc");
  const io: GrantedReadIo = {
    resolveActiveGrant,
    resolveOwnerDb,
    runExecSteps,
    recordUsage,
    newIdempotencyKey,
    ...over,
  };
  return { io, resolveActiveGrant, resolveOwnerDb, runExecSteps, recordUsage };
}

function run(io: GrantedReadIo, opts: { rawSql?: string; idempotencyKey?: string } = {}) {
  return executeGrantedRead(
    {
      buyerTenantId: BUYER,
      requestedDbId: OWNER_DB_ID,
      rawSql: opts.rawSql ?? "SELECT * FROM lessons",
      idempotencyKey: opts.idempotencyKey,
    },
    io,
  );
}

describe("executeGrantedRead — resolve rejects fail closed, no exec, no meter", () => {
  it("passes through no_grant without touching the owner DB or the meter", async () => {
    const { io, resolveOwnerDb, runExecSteps, recordUsage } = makeIo({
      resolveActiveGrant: vi.fn(async () => null),
    });
    expect(await run(io)).toEqual({ ok: false, reason: "no_grant" });
    expect(resolveOwnerDb).not.toHaveBeenCalled();
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("passes through owner_db_missing without exec or meter", async () => {
    const { io, runExecSteps, recordUsage } = makeIo({
      resolveOwnerDb: vi.fn(async () => null),
    });
    expect(await run(io)).toEqual({ ok: false, reason: "owner_db_missing" });
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("passes through not_grantable for a BYO owner DB without exec or meter", async () => {
    const { io, runExecSteps, recordUsage } = makeIo({
      resolveOwnerDb: vi.fn(async () => ({ ...HOSTED_OWNER_DB, connectionBlob: "sealed" })),
    });
    expect(await run(io)).toEqual({ ok: false, reason: "not_grantable" });
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});

describe("executeGrantedRead — scope rejects fail closed, no exec, no meter", () => {
  it("passes through an out_of_scope reject and never runs or meters", async () => {
    const { io, runExecSteps, recordUsage } = makeIo();
    // `pricing` is outside the grant's `[lessons, students]` scope.
    expect(await run(io, { rawSql: "SELECT * FROM pricing" })).toEqual({
      ok: false,
      reason: "out_of_scope",
      detail: "pricing",
    });
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("passes through a not_read_only reject on a write against a granted table", async () => {
    const { io, runExecSteps, recordUsage } = makeIo();
    expect(await run(io, { rawSql: "UPDATE lessons SET title = 'x' WHERE id = 1" })).toEqual({
      ok: false,
      reason: "not_read_only",
    });
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});

describe("executeGrantedRead — an authorized read runs, meters, and returns rows", () => {
  it("runs the exact exec batch on the owner DB and returns un-narrated rows", async () => {
    const { io, runExecSteps } = makeIo();
    const rawSql = "SELECT l.id FROM lessons l JOIN students s ON s.id = l.student_id";
    const res = await run(io, { rawSql, idempotencyKey: "client-key-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.rows).toEqual(ROWS.rows);
    expect(res.rowCount).toBe(2);
    expect(res.grant).toBe(GRANT);
    expect(res.tables).toEqual(["lessons", "students"]);
    // Rows-only contract: no prose/summary seam a caller could narrate through.
    expect(res).not.toHaveProperty("summary");

    // The batch handed to the runner is the owner-scoped grant batch: owner RLS
    // GUCs (never the buyer's), the 30 s in-flight bound, the non-owner
    // `grant_<hex>` role assumed last, then the buyer's statement.
    const role = await grantRoleName(GRANT.id);
    expect(runExecSteps).toHaveBeenCalledWith(HOSTED_OWNER_DB, [
      { text: "SELECT set_config('search_path', $1, true)", params: ["lang_tutor_1"] },
      { text: "SELECT set_config('app.tenant_id', $1, true)", params: [OWNER] },
      { text: "SELECT set_config('app.agent_id', $1, true)", params: [OWNER] },
      { text: `SET LOCAL statement_timeout = '${GRANT_STATEMENT_TIMEOUT}'`, params: [] },
      { text: `SET LOCAL ROLE "${role}"`, params: [] },
      { text: rawSql, params: [] },
    ]);
  });

  it("meters the client's idempotency key with (grant, buyer, seller) attribution", async () => {
    const { io, recordUsage } = makeIo();
    const res = await run(io, { idempotencyKey: "client-key-1" });
    expect(res.ok && res.idempotencyKey).toBe("client-key-1");
    expect(res.ok && res.usageRecorded).toBe(true);
    expect(recordUsage).toHaveBeenCalledWith({
      grantId: GRANT.id,
      ownerTenantId: OWNER,
      ownerDbId: OWNER_DB_ID,
      granteeTenantId: BUYER,
      idempotencyKey: "client-key-1",
    });
  });

  it("synthesizes and meters an idempotency key when the client omits one", async () => {
    const { io, recordUsage } = makeIo();
    const res = await run(io); // no idempotencyKey
    expect(res.ok && res.idempotencyKey).toBe("synth-key-abc");
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "synth-key-abc" }),
    );
  });

  it("returns the rows with usageRecorded=false on a replay (no double-count)", async () => {
    const { io } = makeIo({ recordUsage: vi.fn(async () => ({ recorded: false })) });
    const res = await run(io, { idempotencyKey: "client-key-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toEqual(ROWS.rows);
    expect(res.usageRecorded).toBe(false);
  });
});

describe("executeGrantedRead — a failed exec meters nothing", () => {
  it("propagates the exec error and never records usage", async () => {
    const recordUsage = vi.fn(async () => ({ recorded: true }));
    const { io } = makeIo({
      runExecSteps: vi.fn(async () => {
        throw new Error("db_unreachable");
      }),
      recordUsage,
    });
    await expect(run(io)).rejects.toThrow("db_unreachable");
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
