// Provisioner unit tests. Pure-function shape — Postgres + D1 are
// stubbed via deps injection (vi.mock of worker-internal modules is
// broken under @cloudflare/vitest-pool-workers; see middleware.ts
// header for the upstream issue).
//
// SK-HDC-012 — the provisioner now batches its full statement list
// (`SET LOCAL`, `CREATE SCHEMA`, role + grant, compiled DDL, RLS,
// sample inserts) into a single `pg.transaction([...])` call. Tests
// stub the `transaction` seam and assert the batched statement
// SEQUENCE plus statement count. Per-statement `db.query` spans are
// no longer emitted on the happy path; one `db.transaction` span
// wraps the whole batch.
//
// Span assertions (SK-OBS-005) verify the `db.transaction` wrapper
// carries the SK-HDC-012 attributes (`db.transaction.statement_count`,
// `db.transaction.batch_call=true`).

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dropSchemaAndRegistry,
  provisionDb,
  registerByoDb,
  stripDbPrefix,
} from "./neon-provision.ts";
import type { PgClient, PgTransactionStatement, ProvisionArgs, SchemaPlan } from "./types.ts";

// Tables carry the nested-Column shape (canonical, per
// packages/db/src/types.ts SchemaPlan family). The provisioner
// iterates `plan.tables` for RLS but the actual CREATE TABLE
// strings come pre-compiled in `args.ddl` — so column counts /
// pk shape are never inspected here. Two columns + a PK keep the
// fixture valid against the strict Zod schema (PR #65) which
// requires `description` on Table / Column / SchemaPlan.
function tableShell(name: string) {
  return {
    name,
    description: `${name} table — provisioner test fixture`,
    columns: [
      {
        name: "id",
        type: "integer" as const,
        nullable: false,
        description: "Primary key.",
      },
      {
        name: "label",
        type: "text" as const,
        nullable: true,
        description: "Free-form label column.",
      },
    ],
    primary_key: ["id"],
  };
}

function makePlan(overrides: Partial<SchemaPlan> = {}): SchemaPlan {
  return {
    slug_hint: "orders_tracker",
    description: "provisioner test fixture",
    tables: [tableShell("orders"), tableShell("items")],
    foreign_keys: [],
    metrics: [],
    dimensions: [],
    sample_rows: [
      { table: "orders", values: { id: 1, customer: "alice" } },
      { table: "orders", values: { id: 2, customer: "bob" } },
    ],
    ...overrides,
  };
}

function makeArgs(overrides: Partial<ProvisionArgs> = {}): ProvisionArgs {
  return {
    plan: makePlan(),
    dbId: "db_orders_tracker_a4f3b2",
    schemaName: "orders_tracker_a4f3b2",
    ddl: [
      "CREATE TABLE A (id INT)",
      "CREATE TABLE B (id INT)",
      "CREATE TABLE C (id INT)",
      "CREATE INDEX X ON A (id)",
    ],
    tenantId: "user_42",
    engine: "postgres",
    secretRef: "DATABASE_URL",
    schemaHash: "schema_v1",
    schemaText: "CREATE TABLE A (id INT)\n\nCREATE TABLE B (id INT)",
    ...overrides,
  };
}

type PgStub = {
  pg: PgClient;
  // The single batch call (or none, if tx didn't run).
  batch: PgTransactionStatement[] | undefined;
  // `query()` calls (cleanup-path DROP SCHEMA only on the happy path).
  queries: { sql: string; params?: unknown[] }[];
  setTransactionFails: (error: { code?: string; message?: string } | null) => void;
  setQueryFailOn: (predicate: (sql: string) => boolean) => void;
};

function makePgStub(): PgStub {
  const queries: { sql: string; params?: unknown[] }[] = [];
  let batch: PgTransactionStatement[] | undefined;
  let txFail: { code?: string; message?: string } | null = null;
  let queryFailOn: (sql: string) => boolean = () => false;

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    if (queryFailOn(sql)) {
      throw new Error(`pg.query stub failure on ${sql.slice(0, 60)}`);
    }
    return { rows: [] as Record<string, unknown>[], rowCount: 0 };
  }) as unknown as PgClient["query"];

  const transaction = vi.fn(async (statements: PgTransactionStatement[]) => {
    batch = statements;
    if (txFail) {
      const e: Error & { code?: string } = new Error(
        txFail.message ?? "pg.transaction stub failure",
      );
      if (txFail.code) e.code = txFail.code;
      throw e;
    }
    return statements.map(() => ({ rows: [] as Record<string, unknown>[], rowCount: 0 }));
  }) as unknown as PgClient["transaction"];

  return {
    pg: { query, transaction },
    get batch() {
      return batch;
    },
    queries,
    setTransactionFails(error) {
      txFail = error;
    },
    setQueryFailOn(predicate) {
      queryFailOn = predicate;
    },
  };
}

type D1Stub = {
  d1: D1Database;
  selects: { sql: string; params: unknown[] }[];
  inserts: { sql: string; params: unknown[] }[];
  deletes: { sql: string; params: unknown[] }[];
  setExistingDbId: (value: boolean) => void;
  setInsertFails: (value: boolean) => void;
  setDeleteFails: (value: boolean) => void;
};

function makeD1Stub(): D1Stub {
  const selects: { sql: string; params: unknown[] }[] = [];
  const inserts: { sql: string; params: unknown[] }[] = [];
  const deletes: { sql: string; params: unknown[] }[] = [];
  let existingDbId = false;
  let insertFails = false;
  let deleteFails = false;

  const prepare = vi.fn((sql: string) => {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      first: async () => {
        selects.push({ sql, params: [...bound] });
        if (sql.includes("FROM databases")) {
          return existingDbId ? { id: bound[0] } : null;
        }
        return null;
      },
      run: async () => {
        if (sql.includes("INSERT INTO databases")) {
          inserts.push({ sql, params: [...bound] });
          if (insertFails) throw new Error("D1 insert failed");
          return { success: true, meta: {} };
        }
        if (sql.includes("DELETE FROM databases")) {
          deletes.push({ sql, params: [...bound] });
          if (deleteFails) throw new Error("D1 delete failed");
          return { success: true, meta: {} };
        }
        return { success: true, meta: {} };
      },
    };
    return stmt;
  });

  return {
    d1: { prepare } as unknown as D1Database,
    selects,
    inserts,
    deletes,
    setExistingDbId(value) {
      existingDbId = value;
    },
    setInsertFails(value) {
      insertFails = value;
    },
    setDeleteFails(value) {
      deleteFails = value;
    },
  };
}

// Shared telemetry handle — installed before each test, reset after.
// The provisioner emits spans into the global tracer (the production
// pattern); the in-memory exporter from `@nlqdb/otel/test` captures
// them so we can assert on names + attributes.
let telemetry: TestTelemetry;
beforeEach(() => {
  telemetry = createTestTelemetry();
});
afterEach(() => {
  telemetry.reset();
});

describe("provisionDb — happy path", () => {
  it("commits Postgres, writes D1, returns ok with the new dbId + null pkLive", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result).toEqual({
      ok: true,
      dbId: "db_orders_tracker_a4f3b2",
      schemaName: "orders_tracker_a4f3b2",
    });
    expect(d1.inserts).toHaveLength(1);
    expect(d1.inserts[0]?.params).toEqual([
      "db_orders_tracker_a4f3b2",
      "user_42",
      "postgres",
      "DATABASE_URL",
      "schema_v1",
      "CREATE TABLE A (id INT)\n\nCREATE TABLE B (id INT)",
    ]);
    // SK-ANON-002 — the create seeds `last_queried_at` (a successful
    // create returned sampleRows = the first answer) so the age-sweep
    // can evict it after the 90-day TTL and the anon first-answer
    // funnel metric counts it.
    expect(d1.inserts[0]?.sql).toContain("last_queried_at");
  });

  it("persists the engine column verbatim from args.engine (SK-DB-010)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, makeArgs({ engine: "clickhouse" }));
    expect(result.ok).toBe(true);
    expect(d1.inserts).toHaveLength(1);
    // Position 2 in the bind list is the engine — assert it traveled
    // through unchanged. The Phase-1 file is the Neon provisioner so
    // a non-postgres engine here is a contract test, not a runtime
    // path; W2's Tinybird provisioner takes over for clickhouse.
    expect(d1.inserts[0]?.params[2]).toBe("clickhouse");
  });

  it("issues one pg.transaction batch in the contract-mandated order (SK-HDC-012)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(pg.batch).toBeDefined();
    if (!pg.batch) throw new Error("expected batch");
    const sqls = pg.batch.map((s) => s.sql);
    let i = 0;
    // SK-HDC-010: 30s default cap as the first statement of the batch.
    expect(sqls[i++]).toBe("SET LOCAL statement_timeout = '30s'");
    // SK-HDC-012: bare CREATE SCHEMA (no IF NOT EXISTS); the in-band
    // populated guard is gone — collision surfaces via SQLSTATE 42P06.
    expect(sqls[i++]).toBe('CREATE SCHEMA "orders_tracker_a4f3b2"');
    expect(sqls[i++]).toMatch(/CREATE ROLE/);
    expect(sqls[i++]).toMatch(/GRANT USAGE ON SCHEMA "orders_tracker_a4f3b2"/);
    // DDL is included in the caller-supplied order. CREATE TABLEs
    // run under the 30s default; CREATE INDEX is bracketed by 600s
    // bumps per SK-HDC-010, all within the same batch transaction
    // (SET LOCAL scopes to the server-side BEGIN/COMMIT).
    expect(sqls[i++]).toBe(args.ddl[0]);
    expect(sqls[i++]).toBe(args.ddl[1]);
    expect(sqls[i++]).toBe(args.ddl[2]);
    expect(sqls[i++]).toBe("SET LOCAL statement_timeout = '600s'");
    expect(sqls[i++]).toBe(args.ddl[3]);
    expect(sqls[i++]).toBe("SET LOCAL statement_timeout = '30s'");
    // RLS pair per table — ALTER ENABLE then CREATE POLICY.
    expect(sqls[i++]).toMatch(/ALTER TABLE "orders_tracker_a4f3b2"\."orders" ENABLE ROW LEVEL/);
    expect(sqls[i++]).toMatch(
      /CREATE POLICY tenant_isolation ON "orders_tracker_a4f3b2"\."orders"/,
    );
    expect(sqls[i++]).toMatch(/ALTER TABLE "orders_tracker_a4f3b2"\."items" ENABLE ROW LEVEL/);
    expect(sqls[i++]).toMatch(/CREATE POLICY tenant_isolation ON "orders_tracker_a4f3b2"\."items"/);
    // Sample-row inserts are parameterised.
    expect(sqls[i++]).toMatch(/INSERT INTO "orders_tracker_a4f3b2"\."orders"/);
    expect(sqls[i++]).toMatch(/INSERT INTO "orders_tracker_a4f3b2"\."orders"/);
    // SK-HDC-012: NO BEGIN/COMMIT/ROLLBACK literals — Neon's
    // transaction() wraps server-side. NO information_schema probe —
    // the in-band populated guard is gone (collision → 42P06).
    expect(sqls.some((s) => /^BEGIN\b/i.test(s))).toBe(false);
    expect(sqls.some((s) => /^COMMIT\b/i.test(s))).toBe(false);
    expect(sqls.some((s) => /^ROLLBACK\b/i.test(s))).toBe(false);
    expect(sqls.some((s) => /information_schema/.test(s))).toBe(false);
    expect(sqls).toHaveLength(i);
  });

  it("parameterises sample-row INSERTs (no string interpolation of values)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    if (!pg.batch) throw new Error("expected batch");
    const inserts = pg.batch.filter((s) => /^INSERT INTO/.test(s.sql));
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.sql).toMatch(/VALUES \(\$1, \$2\)/);
    expect(inserts[0]?.params).toEqual([1, "alice"]);
    expect(inserts[1]?.params).toEqual([2, "bob"]);
  });

  it("embeds the tenant id in the RLS policy literal", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({ tenantId: "user_42" });

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    if (!pg.batch) throw new Error("expected batch");
    const policy = pg.batch.find((s) => /CREATE POLICY tenant_isolation/.test(s.sql));
    expect(policy?.sql).toContain("current_setting('app.tenant_id', true) = 'user_42'");
  });

  it("escapes embedded single quotes in tenantId before inlining into the policy", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    // Anonymous tenants take the form "anon:<token>" — colons are SQL-safe,
    // but a hostile or accidentally-quoted tenant id must not break out
    // of the policy's string literal.
    const args = makeArgs({ tenantId: "anon:o'malley" });

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    if (!pg.batch) throw new Error("expected batch");
    const policy = pg.batch.find((s) => /CREATE POLICY tenant_isolation/.test(s.sql));
    expect(policy?.sql).toContain("'anon:o''malley'");
  });
});

describe("provisionDb — failure paths", () => {
  it("D1 row already present for dbId → schema_already_exists with rolled_back=false; pg untouched", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    d1.setExistingDbId(true);
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result).toEqual({
      ok: false,
      reason: "schema_already_exists",
      rolled_back: false,
    });
    expect(pg.batch).toBeUndefined();
    expect(pg.queries).toHaveLength(0);
    expect(d1.inserts).toHaveLength(0);
  });

  it("transaction failure with SQLSTATE 42P06 → schema_already_exists, rolled_back=true (collision)", async () => {
    // SK-HDC-012 dropped the in-band populated guard; a true id-suffix
    // collision now surfaces as 42P06 from CREATE SCHEMA. The
    // orchestrator retries with a fresh suffix.
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "42P06", message: "duplicate schema" });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("schema_already_exists");
      expect(result.rolled_back).toBe(true);
    }
    expect(d1.inserts).toHaveLength(0);
  });

  it("transaction failure with SQLSTATE 42P07 → ddl_execution_failed", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "42P07", message: "duplicate table" });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("ddl_execution_failed");
      expect(result.rolled_back).toBe(true);
    }
    expect(d1.inserts).toHaveLength(0);
  });

  it("transaction failure with integrity-violation SQLSTATE → sample_insert_failed", async () => {
    // 23505 = unique_violation; 23502 = not_null_violation. The DDL
    // statements run before the inserts in the batch, so a 23xxx
    // failure implies the INSERT phase tripped the constraint.
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "23505", message: "unique violation" });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("sample_insert_failed");
      expect(result.rolled_back).toBe(true);
    }
  });

  it("SK-HDC-017 — data-exception SQLSTATE (22P02 bad sample value) → sample_insert_failed", async () => {
    // 22P02 = invalid_text_representation — a free-chain sample row
    // whose value doesn't parse for its column type. Class 22 can only
    // come from the INSERT phase, so it maps with the 23xxx integrity
    // class rather than the prior catch-all `transaction_failed`.
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({
      code: "22P02",
      message: 'invalid input syntax for type integer: "abc"',
    });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("sample_insert_failed");
      expect(result.rolled_back).toBe(true);
    }
  });

  it("SK-HDC-017 — undefined-object SQLSTATE (42704 hallucinated type) → ddl_execution_failed", async () => {
    // 42704 = undefined_object — the free chain emitted DDL referencing
    // a type Postgres doesn't know (e.g. `TEXTT`). Class 42 is the DDL
    // phase; it now surfaces as `ddl_execution_failed` instead of the
    // opaque `transaction_failed` that starved the FLOW-004 walker.
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "42704", message: 'type "textt" does not exist' });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("ddl_execution_failed");
      expect(result.rolled_back).toBe(true);
    }
  });

  it("SK-HDC-017 — syntax-error SQLSTATE (42601) → ddl_execution_failed", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "42601", message: "syntax error at or near" });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("ddl_execution_failed");
    }
  });

  it("transaction failure without SQLSTATE → transaction_failed", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ message: "fetch failed: TLS error" });
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("transaction_failed");
      expect(result.rolled_back).toBe(true);
    }
  });

  it("D1 INSERT failure after Postgres COMMIT → DROP SCHEMA cleanup attempted; registry_insert_failed", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    d1.setInsertFails(true);
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("registry_insert_failed");
      expect(result.rolled_back).toBe(true);
    }
    // Cleanup-path DROP SCHEMA goes via pg.query (single round-trip),
    // not the batch path. `IF EXISTS` is part of the primitive so a
    // partial-retry against an already-gone schema doesn't re-fail.
    expect(
      pg.queries.some((c) => /DROP SCHEMA IF EXISTS "orders_tracker_a4f3b2" CASCADE/.test(c.sql)),
    ).toBe(true);
    // SK-HDC-011 — the registry-insert-failed branch calls
    // `dropSchemaAndRegistry` to undo the Postgres-side state. The
    // D1 INSERT never landed here, so the DELETE is a no-op against
    // the registry but still runs.
    expect(d1.deletes).toHaveLength(1);
    expect(d1.deletes[0]?.params).toEqual(["db_orders_tracker_a4f3b2"]);
  });

  it("DROP SCHEMA cleanup failure does not mask registry_insert_failed", async () => {
    const pg = makePgStub();
    pg.setQueryFailOn((sql) => /^DROP SCHEMA/.test(sql));
    const d1 = makeD1Stub();
    d1.setInsertFails(true);
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      // Original cause surfaces; cleanup error is swallowed so the
      // sweep job (docs/architecture.md §3.6.6) can pick up the orphan schema later.
      expect(result.reason).toBe("registry_insert_failed");
    }
  });
});

describe("provisionDb — input validation (SK-HDC-009)", () => {
  it("rejects a dbId that does not start with 'db_'", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({ dbId: "not_a_db_id" });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/dbId/);
    expect(pg.batch).toBeUndefined();
  });

  it("rejects a dbId that produces an unsafe schema identifier", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    // Strip "db_" → schema name `bad"; DROP SCHEMA public; --` would
    // break out of the double-quoted form if not validated.
    const args = makeArgs({ dbId: 'db_bad"; DROP SCHEMA public; --' });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/unsafe schemaName/);
    expect(pg.batch).toBeUndefined();
  });

  it("rejects a sample-row whose table contains a quote", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({
      plan: makePlan({
        sample_rows: [{ table: 'orders"; DROP TABLE x; --', values: { id: 1 } }],
      }),
    });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/unsafe sampleRow/);
    // No batch ever issued — assertion fires in `buildSampleInsert`
    // during pre-batch construction.
    expect(pg.batch).toBeUndefined();
  });

  it("rejects a sample-row whose column contains a quote", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({
      plan: makePlan({
        sample_rows: [{ table: "orders", values: { 'evil"; --': 1 } }],
      }),
    });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/unsafe sampleRow/);
    expect(pg.batch).toBeUndefined();
  });

  it("rejects a table name that exceeds Postgres's 63-char identifier limit", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({
      plan: makePlan({
        tables: [tableShell("t".repeat(64))],
        sample_rows: [],
      }),
    });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/63-char/);
    expect(pg.batch).toBeUndefined();
  });
});

describe("provisionDb — observability (GLOBAL-014, SK-OBS-005, SK-HDC-012)", () => {
  it("emits one `db.transaction` span wrapping the batch", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const spans = telemetry.spanExporter.getFinishedSpans();
    const txSpans = spans.filter((s) => s.name === "db.transaction");
    expect(txSpans).toHaveLength(1);
    const txSpan = txSpans[0];
    expect(txSpan?.attributes["db.system"]).toBe("postgresql");
    expect(txSpan?.attributes["db.transaction.batch_call"]).toBe(true);
    // Batch size: 1 SET LOCAL + CREATE SCHEMA + DO role + GRANT +
    // 3 CREATE TABLE + (SET 600s + CREATE INDEX + SET 30s) +
    // 4 RLS rows (2×ALTER+POLICY) + 2 INSERTs = 16 statements.
    expect(txSpan?.attributes["db.transaction.statement_count"]).toBe(16);
  });

  it("emits NO per-statement `db.query` spans on the happy path (SK-HDC-012)", async () => {
    // SK-HDC-012 collapses the per-statement spans into one batch span.
    // Cleanup-path DROP SCHEMA still emits `db.query`, but that path
    // doesn't run on the happy path.
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const querySpans = telemetry.spanExporter
      .getFinishedSpans()
      .filter((s) => s.name === "db.query");
    expect(querySpans).toHaveLength(0);
  });

  it("marks the `db.transaction` span ERROR and pins the SQLSTATE when the batch throws (SK-HDC-017)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ code: "42704", message: 'type "textt" does not exist' });
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const txSpan = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "db.transaction");
    expect(txSpan).toBeDefined();
    expect(txSpan?.events.some((e) => e.name === "exception")).toBe(true);
    expect(txSpan?.attributes["db.transaction.error_sqlstate"]).toBe("42704");
  });

  it("SK-HDC-017 — records `error_sqlstate=none` when the failure carries no SQLSTATE (infra)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    pg.setTransactionFails({ message: "fetch failed: TLS error" });
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const txSpan = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "db.transaction");
    expect(txSpan?.attributes["db.transaction.error_sqlstate"]).toBe("none");
  });

  it("SK-HDC-017 — does NOT set `error_sqlstate` on a successful provision", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const txSpan = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "db.transaction");
    expect(txSpan?.attributes["db.transaction.error_sqlstate"]).toBeUndefined();
  });

  it("emits a `db.query` span when the cleanup path's DROP SCHEMA runs", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    d1.setInsertFails(true); // forces the registry-insert-failed branch
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const querySpans = telemetry.spanExporter
      .getFinishedSpans()
      .filter((s) => s.name === "db.query");
    expect(querySpans.length).toBeGreaterThan(0);
    const dropSpan = querySpans.find((s) => s.attributes["db.operation"] === "DROP SCHEMA");
    expect(dropSpan).toBeDefined();
  });
});

describe("dropSchemaAndRegistry (SK-HDC-011)", () => {
  // Per SK-HDC-011 + SK-HDC-016 the primitive is **strict** on error
  // — both create-rollback and user-delete callers wrap with their
  // own try/catch when they need best-effort semantics. The Postgres
  // step uses `DROP SCHEMA IF EXISTS` so a partial-retry against an
  // already-gone schema doesn't re-fail at that step.
  const tracer = trace.getTracer("@nlqdb/api/db-create-test");

  it("schema present + row present → DROP IF EXISTS runs and DELETE runs", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();

    await dropSchemaAndRegistry(tracer, pg.pg, d1.d1, "db_x_a4f3b2", "x_a4f3b2");

    expect(pg.queries.map((c) => c.sql)).toContain('DROP SCHEMA IF EXISTS "x_a4f3b2" CASCADE');
    expect(d1.deletes).toHaveLength(1);
    expect(d1.deletes[0]?.params).toEqual(["db_x_a4f3b2"]);
  });

  it("Postgres DROP fails → error propagates, D1 DELETE does NOT run (strict mode)", async () => {
    const pg = makePgStub();
    pg.setQueryFailOn((sql) => /^DROP SCHEMA/.test(sql));
    const d1 = makeD1Stub();

    await expect(
      dropSchemaAndRegistry(tracer, pg.pg, d1.d1, "db_x_a4f3b2", "x_a4f3b2"),
    ).rejects.toThrow();
    // Critical for SK-HDC-016: never claim "deleted" to the user when
    // the underlying data still exists in Neon. The registry row must
    // stay so a retry (manual / operator / sweep) can find it.
    expect(d1.deletes).toHaveLength(0);
  });

  it("D1 DELETE fails after a successful DROP → error propagates", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    d1.setDeleteFails(true);

    await expect(
      dropSchemaAndRegistry(tracer, pg.pg, d1.d1, "db_x_a4f3b2", "x_a4f3b2"),
    ).rejects.toThrow();
    // DROP did run before the D1 failure, so the orphan is now an
    // orphan registry row (schema gone, row remains). Retry-safe:
    // the next call's IF-EXISTS DROP no-ops and the D1 DELETE
    // re-attempts.
    expect(pg.queries.map((c) => c.sql)).toContain('DROP SCHEMA IF EXISTS "x_a4f3b2" CASCADE');
  });

  it("rejects unsafe schema identifiers at the boundary (SK-HDC-009 carry-through)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();

    await expect(
      dropSchemaAndRegistry(tracer, pg.pg, d1.d1, "db_x_a4f3b2", 'x"; DROP TABLE foo; --'),
    ).rejects.toThrow(/unsafe schemaName/);
    expect(pg.queries).toHaveLength(0);
    expect(d1.deletes).toHaveLength(0);
  });
});

describe("stripDbPrefix (exported for SK-HDC-016 DELETE /v1/databases/:id)", () => {
  it("strips the leading db_ so the schema name is the orchestrator-minted suffix", () => {
    expect(stripDbPrefix("db_orders_tracker_a4f3b2")).toBe("orders_tracker_a4f3b2");
  });

  it("throws on an id without the db_ prefix — defense in depth before SQL identifier quoting", () => {
    expect(() => stripDbPrefix("legacy_no_prefix")).toThrow(/must start with "db_"/);
  });

  it("throws on an empty string for the same defensive reason", () => {
    expect(() => stripDbPrefix("")).toThrow(/must start with "db_"/);
  });
});

describe("registerByoDb — Phase 4 stub (SK-HDC-007)", () => {
  it("throws NotImplementedError so the orchestrator's injection seam is real today", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    // Phase-4 BYO connection_url is not yet a field on ProvisionArgs
    // — the registerByoDb signature shares ProvisionArgs with provisionDb
    // via ProvisionFn, and the connection-url ingest will land alongside
    // the Phase-4 endpoint (`POST /v1/db/connect`). For today's stub we
    // just hand it the same args; the function throws before reading them.
    const byoArgs: ProvisionArgs = makeArgs();

    await expect(registerByoDb({ pg: pg.pg, d1: d1.d1 }, byoArgs)).rejects.toThrow(/Phase 4/);
    // No Postgres or D1 work should have happened.
    expect(pg.batch).toBeUndefined();
    expect(d1.inserts).toHaveLength(0);
  });
});
