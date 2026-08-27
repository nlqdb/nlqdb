// Granted-ask composition tests (SK-EKP-008, EK-06 box 2 — the schema-only
// planning half). `orchestrateGrantedAsk` resolves the grant + owner DB, plans
// the buyer's goal against the OWNER's schema, then runs it through the real
// `executeGrantedRead`. These drive the REAL executor over fake I/O (not a
// mocked executor) so the composition is proven end to end without a live DB,
// pinning: (1) a resolve reject fails closed BEFORE the planner runs — no plan,
// no exec, no meter; (2) a live grant on an unschema'd owner DB is
// `schema_unavailable`, again before planning; (3) the planner sees the owner's
// SCHEMA text and nothing else (GLOBAL-037), and its SQL is normalised
// schema-relative before it reaches the scope guardrail; (4) a scope reject from
// the executor passes through and meters nothing.

import { describe, expect, it, vi } from "vitest";
import type { DbRecord, QueryResult } from "./ask/types.ts";
import { orchestrateGrantedAsk } from "./grant-ask.ts";
import type { GrantedReadIo } from "./grant-orchestrate.ts";
import type { GrantRecord } from "./grants.ts";

const BUYER = "user_buyer_2";
const OWNER = "user_owner_1";
const OWNER_DB_ID = "db_lang_tutor_1";
// resolveGrantedRead derives the owner schema as the dbId minus its `db_` prefix.
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

function run(
  io: GrantedReadIo,
  planReadSql: (goal: string, schema: string) => Promise<string>,
  opts: { goal?: string; idempotencyKey?: string } = {},
) {
  return orchestrateGrantedAsk(
    {
      buyerTenantId: BUYER,
      requestedDbId: OWNER_DB_ID,
      goal: opts.goal ?? "how many lessons per student",
      ...(opts.idempotencyKey !== undefined ? { idempotencyKey: opts.idempotencyKey } : {}),
    },
    { io, planReadSql },
  );
}

describe("orchestrateGrantedAsk — resolve rejects fail closed before planning", () => {
  it("returns no_grant without planning, exec, or metering", async () => {
    const { io, runExecSteps, recordUsage } = makeIo({
      resolveActiveGrant: vi.fn(async () => null),
    });
    const planReadSql = vi.fn(async () => "SELECT 1");
    expect(await run(io, planReadSql)).toEqual({ ok: false, reason: "no_grant" });
    expect(planReadSql).not.toHaveBeenCalled();
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("returns owner_db_missing without planning", async () => {
    const { io } = makeIo({ resolveOwnerDb: vi.fn(async () => null) });
    const planReadSql = vi.fn(async () => "SELECT 1");
    expect(await run(io, planReadSql)).toEqual({ ok: false, reason: "owner_db_missing" });
    expect(planReadSql).not.toHaveBeenCalled();
  });

  it("returns not_grantable for a BYO owner DB without planning", async () => {
    const { io } = makeIo({
      resolveOwnerDb: vi.fn(async () => ({ ...HOSTED_OWNER_DB, connectionBlob: "sealed" })),
    });
    const planReadSql = vi.fn(async () => "SELECT 1");
    expect(await run(io, planReadSql)).toEqual({ ok: false, reason: "not_grantable" });
    expect(planReadSql).not.toHaveBeenCalled();
  });
});

describe("orchestrateGrantedAsk — an unschema'd owner DB fails closed before planning", () => {
  it("returns schema_unavailable without planning, exec, or metering", async () => {
    const { io, runExecSteps, recordUsage } = makeIo({
      resolveOwnerDb: vi.fn(async () => ({ ...HOSTED_OWNER_DB, schemaText: null })),
    });
    const planReadSql = vi.fn(async () => "SELECT 1");
    expect(await run(io, planReadSql)).toEqual({ ok: false, reason: "schema_unavailable" });
    expect(planReadSql).not.toHaveBeenCalled();
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});

describe("orchestrateGrantedAsk — an authorized ask plans schema-only and returns rows", () => {
  it("plans against the owner SCHEMA (GLOBAL-037: no owner rows reach the planner)", async () => {
    const { io } = makeIo();
    const planReadSql = vi.fn(async () => "SELECT * FROM lessons");
    await run(io, planReadSql, { goal: "count lessons" });
    // The planner is handed the goal and the owner's schema text — never a
    // resolved owner row / cell value.
    expect(planReadSql).toHaveBeenCalledWith("count lessons", OWNER_SCHEMA_TEXT);
  });

  it("normalises the planned SQL schema-relative before the scope guardrail", async () => {
    const { io, runExecSteps } = makeIo();
    // The planner qualified with the owner's physical schema; the composition
    // strips it so search_path resolves it AND the scope check sees bare names.
    const planReadSql = vi.fn(async () => `SELECT * FROM ${OWNER_SCHEMA}.lessons`);
    const res = await run(io, planReadSql, { idempotencyKey: "client-key-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toEqual(ROWS.rows);
    expect(res.rowCount).toBe(2);
    // The user statement handed to the runner is the stripped, schema-relative SQL.
    expect(runExecSteps).toHaveBeenCalledTimes(1);
    const execSteps = runExecSteps.mock.calls[0]?.[1] as { text: string; params: unknown[] }[];
    expect(execSteps.at(-1)).toEqual({ text: "SELECT * FROM lessons", params: [] });
    // Rows-only: no prose/summary seam a caller could narrate through.
    expect(res).not.toHaveProperty("summary");
  });

  it("threads the client idempotency key through to the meter", async () => {
    const { io, recordUsage } = makeIo();
    const planReadSql = vi.fn(async () => "SELECT * FROM lessons");
    const res = await run(io, planReadSql, { idempotencyKey: "client-key-1" });
    expect(res.ok && res.idempotencyKey).toBe("client-key-1");
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        grantId: GRANT.id,
        ownerTenantId: OWNER,
        granteeTenantId: BUYER,
        idempotencyKey: "client-key-1",
      }),
    );
  });

  it("synthesizes an idempotency key when the client omits one", async () => {
    const { io, recordUsage } = makeIo();
    const planReadSql = vi.fn(async () => "SELECT * FROM lessons");
    const res = await run(io, planReadSql);
    expect(res.ok && res.idempotencyKey).toBe("synth-key-abc");
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "synth-key-abc" }),
    );
  });
});

describe("orchestrateGrantedAsk — a scope reject from the executor passes through", () => {
  it("returns out_of_scope and meters nothing when the plan reaches beyond scope", async () => {
    const { io, runExecSteps, recordUsage } = makeIo();
    // `pricing` is outside the grant's [lessons, students] scope.
    const planReadSql = vi.fn(async () => "SELECT * FROM pricing");
    expect(await run(io, planReadSql)).toEqual({
      ok: false,
      reason: "out_of_scope",
      detail: "pricing",
    });
    expect(runExecSteps).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
