// SK-SCHEMA-012 — `/v1/insert` orchestrator over stub deps: one transaction,
// race re-plan, error mapping, and 0 `llm.*` spans (GLOBAL-041 Phase A exit).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateCompiledDdl } from "../ask/sql-validate-ddl.ts";
import type { DbRecord } from "../ask/types.ts";
import type { PgClient, PgTransactionStatement } from "../db-create/types.ts";
import { type InsertDeps, orchestrateInsert } from "./orchestrate.ts";

const db: DbRecord = {
  id: "db_app1",
  tenantId: "user_1",
  engine: "postgres",
  connectionSecretRef: "ref",
  schemaHash: "h0",
  schemaText: "CREATE TABLE app1.votes (id uuid);",
  connectionBlob: null,
};

function pgStub(
  columns: { table_name: string; column_name: string; data_type: string }[],
  transaction: PgClient["transaction"] = async (s) =>
    s.map((_, i) =>
      i === s.length - 1 ? { rows: [{ id: "x" }], rowCount: 1 } : { rows: [], rowCount: 0 },
    ),
): PgClient {
  return {
    query: vi.fn(async () => ({ rows: columns, rowCount: columns.length })) as PgClient["query"],
    transaction: vi.fn(transaction),
  };
}

function deps(pg: PgClient, over: Partial<InsertDeps> = {}): InsertDeps {
  const run = vi.fn(async () => ({ meta: { changes: 1 } }));
  const d1 = { prepare: () => ({ bind: () => ({ run }) }) } as unknown as D1Database;
  return {
    resolveDb: async () => db,
    rateLimiter: { check: async () => ({ allowed: true, count: 1, limit: 60, resetAt: 0 }) },
    pg,
    d1,
    validateCompiledDdl: () => ({ ok: true }),
    ...over,
  };
}

const req = {
  dbId: "db_app1",
  table: "votes",
  rows: [{ vote: "up", serverId: "s1" }],
  userId: "user_1",
};

let tel: TestTelemetry;
beforeEach(() => {
  tel = createTestTelemetry();
});
afterEach(() => tel.reset());

describe("orchestrateInsert", () => {
  it("creates an unseen table and lands the row in one transaction, with no llm span", async () => {
    const pg = pgStub([]);
    const out = await orchestrateInsert(deps(pg), req);
    expect(out).toMatchObject({ ok: true, widened: true });
    if (!out.ok) return;
    expect(out.result.rows).toEqual([{ id: "x" }]);
    expect(out.result.widen?.tables).toEqual(["votes"]);
    expect(out.result.widen?.ddl[0]).toMatch(/^CREATE TABLE "app1"\."votes"/);
    expect(out.result.widen?.schema_rewritten).toBe(true);
    expect(pg.transaction).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(pg.transaction).mock.calls[0]?.[0] as PgTransactionStatement[];
    expect(batch.at(-1)?.sql).toMatch(/^INSERT INTO "app1"\."votes"/);
    const names = tel.spanExporter.getFinishedSpans().map((s) => s.name);
    expect(names).toContain("db.transaction");
    expect(names.filter((n) => n.startsWith("llm."))).toEqual([]);
  });

  it("passes the real DDL allow-list for both a new table and a new column", async () => {
    const created = await orchestrateInsert(deps(pgStub([]), { validateCompiledDdl }), {
      ...req,
      rows: [{ id: 7, payload: { a: [1] }, ok: true }],
    });
    const widened = await orchestrateInsert(
      deps(pgStub([{ table_name: "votes", column_name: "vote", data_type: "text" }]), {
        validateCompiledDdl,
      }),
      req,
    );
    expect(created).toMatchObject({ ok: true, widened: true });
    expect(widened).toMatchObject({ ok: true, widened: true });
  });

  it("writes an all-observed row without DDL and without widening", async () => {
    const pg = pgStub([
      { table_name: "votes", column_name: "vote", data_type: "text" },
      { table_name: "votes", column_name: "server_id", data_type: "text" },
    ]);
    const out = await orchestrateInsert(deps(pg), req);
    expect(out).toMatchObject({ ok: true, widened: false });
    const batch = vi.mocked(pg.transaction).mock.calls[0]?.[0] as PgTransactionStatement[];
    expect(batch.map((s) => s.sql.split(" ")[0])).toEqual(["SET", "INSERT"]);
  });

  it("lifts the id sequence right before an INSERT that names an integer id", async () => {
    const pg = pgStub([
      { table_name: "votes", column_name: "id", data_type: "bigint" },
      { table_name: "votes", column_name: "vote", data_type: "text" },
    ]);
    await orchestrateInsert(deps(pg), { ...req, rows: [{ id: 9, vote: "up" }, { vote: "down" }] });
    const batch = vi.mocked(pg.transaction).mock.calls[0]?.[0] as PgTransactionStatement[];
    expect(batch.map((s) => s.sql.split(" ")[0])).toEqual(["SET", "SELECT", "INSERT"]);
    expect(batch[1]?.params).toEqual([9, '"app1"."votes"']);
  });

  it("upserts a keyed write: index first, one INSERT per row shape, every row returned", async () => {
    const cols = [
      { table_name: "votes", column_name: "id", data_type: "bigint" },
      { table_name: "votes", column_name: "server_id", data_type: "numeric" },
      { table_name: "votes", column_name: "stars", data_type: "numeric" },
    ];
    const pg: PgClient = {
      query: vi.fn(async (sql: string) =>
        sql.includes("pg_index")
          ? { rows: [{ cols: ["id"] }], rowCount: 1 }
          : { rows: cols, rowCount: cols.length },
      ) as PgClient["query"],
      transaction: vi.fn(async (s: PgTransactionStatement[]) =>
        s.map((st) =>
          st.sql.startsWith("INSERT")
            ? { rows: [{ ok: st.params }], rowCount: 1 }
            : { rows: [], rowCount: 0 },
        ),
      ),
    };
    const out = await orchestrateInsert(deps(pg, { validateCompiledDdl }), {
      ...req,
      rows: [{ id: 9, serverId: 1, stars: 4 }, { serverId: 2 }],
      key: ["serverId"],
    });
    expect(out).toMatchObject({ ok: true, widened: false, result: { rowCount: 2 } });
    if (!out.ok) return;
    expect(out.result.index).toMatch(/^CREATE UNIQUE INDEX IF NOT EXISTS "votes_server_id_key"/);
    expect(out.result.widen).toBeUndefined();
    const batch = vi.mocked(pg.transaction).mock.calls[0]?.[0] as PgTransactionStatement[];
    expect(batch.map((s) => s.sql.split(" ").slice(0, 2).join(" "))).toEqual([
      "SET LOCAL",
      "LOCK TABLE",
      "CREATE UNIQUE",
      "SELECT setval(seq::regclass,",
      "INSERT INTO",
      "INSERT INTO",
    ]);
  });

  it("reads unique indexes only for a keyed write", async () => {
    const pg = pgStub([{ table_name: "votes", column_name: "vote", data_type: "text" }]);
    await orchestrateInsert(deps(pg), { ...req, rows: [{ vote: "up" }] });
    expect(pg.query).toHaveBeenCalledTimes(1);
  });

  it("re-observes and re-plans once when a concurrent insert widened first", async () => {
    let calls = 0;
    const pg = pgStub([], async (s) => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("exists"), { code: "42P07" });
      return s.map(() => ({ rows: [], rowCount: 1 }));
    });
    const out = await orchestrateInsert(deps(pg), req);
    expect(out.ok).toBe(true);
    expect(pg.query).toHaveBeenCalledTimes(2);
  });

  it("maps a refused value to invalid_value and counts it against KPI 1", async () => {
    const pg = pgStub([], async () => {
      throw Object.assign(new Error("bad"), { code: "22P02" });
    });
    const out = await orchestrateInsert(deps(pg), req);
    expect(out).toMatchObject({ ok: false, widened: true, error: { code: "invalid_value" } });
  });

  it("refuses BYO databases and unknown ids before touching Postgres", async () => {
    const pg = pgStub([]);
    const byo = await orchestrateInsert(
      deps(pg, { resolveDb: async () => ({ ...db, connectionBlob: "sealed" }) }),
      req,
    );
    const missing = await orchestrateInsert(deps(pg, { resolveDb: async () => null }), req);
    expect(byo).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(missing).toMatchObject({ ok: false, error: { code: "db_not_found" } });
    expect(pg.query).not.toHaveBeenCalled();
  });

  it("returns invalid_body for a malformed row", async () => {
    const out = await orchestrateInsert(deps(pgStub([])), { ...req, rows: [{}] });
    expect(out).toMatchObject({ ok: false, error: { code: "invalid_body" } });
  });
});
