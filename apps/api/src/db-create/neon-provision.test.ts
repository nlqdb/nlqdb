// Provisioner unit tests. Pure-function shape — Postgres + D1 are
// stubbed via deps injection (vi.mock of worker-internal modules is
// broken under @cloudflare/vitest-pool-workers; see middleware.ts
// header for the upstream issue). We assert both the happy-path
// outcome and the contract-level pg.query SEQUENCE (BEGIN → CREATE
// SCHEMA → populated check → CREATE ROLE → GRANT → DDL[] → RLS[] →
// INSERTs → COMMIT) — ordering is part of the provisioner's
// contract because RLS must enable AFTER the table exists, and the
// D1 row must land AFTER Postgres COMMITs (docs/design.md §3.6.6).
//
// Span assertions (SK-OBS-005) verify the `db.transaction` wrapper
// and per-statement `db.query` spans land for every Postgres call,
// matching the catalog in docs/performance.md §3.1.

import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { provisionDb, registerByoDb } from "./neon-provision.ts";
import type { PgClient, ProvisionArgs, SchemaPlan } from "./types.ts";

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
    secretRef: "DATABASE_URL",
    schemaHash: "schema_v1",
    ...overrides,
  };
}

type PgStub = {
  pg: PgClient;
  calls: { sql: string; params?: unknown[] }[];
  setFailOn: (predicate: (sql: string, callIndex: number) => boolean) => void;
  setSchemaPopulated: (value: boolean) => void;
};

function makePgStub(): PgStub {
  const calls: { sql: string; params?: unknown[] }[] = [];
  let failOn: (sql: string, callIndex: number) => boolean = () => false;
  let populated = false;
  let callIndex = 0;

  // Cast through `unknown` because vi.fn's inferred return type can't
  // unify with PgClient.query's generic <T> — the mock returns a
  // concrete row shape that's narrower than the call-site T. Same
  // pattern as elsewhere in the suite.
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const idx = callIndex++;
    calls.push({ sql, params });
    if (failOn(sql, idx)) {
      throw new Error(`pg stub failure on call ${idx}: ${sql.slice(0, 60)}`);
    }
    if (populated && /information_schema\.tables/i.test(sql)) {
      return { rows: [{ "?column?": 1 } as Record<string, unknown>], rowCount: 1 };
    }
    return { rows: [] as Record<string, unknown>[], rowCount: 0 };
  }) as unknown as PgClient["query"];

  return {
    pg: { query },
    calls,
    setFailOn(predicate) {
      failOn = predicate;
    },
    setSchemaPopulated(value) {
      populated = value;
    },
  };
}

type D1Stub = {
  d1: D1Database;
  selects: { sql: string; params: unknown[] }[];
  inserts: { sql: string; params: unknown[] }[];
  setExistingDbId: (value: boolean) => void;
  setInsertFails: (value: boolean) => void;
};

function makeD1Stub(): D1Stub {
  const selects: { sql: string; params: unknown[] }[] = [];
  const inserts: { sql: string; params: unknown[] }[] = [];
  let existingDbId = false;
  let insertFails = false;

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
        return { success: true, meta: {} };
      },
    };
    return stmt;
  });

  return {
    d1: { prepare } as unknown as D1Database,
    selects,
    inserts,
    setExistingDbId(value) {
      existingDbId = value;
    },
    setInsertFails(value) {
      insertFails = value;
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
      // pkLive is null in the provisioner v0 — the api-keys subsystem
      // mints `pk_live_<dbId>` separately. Orchestrator handles the
      // anonymous-vs-authed split before issuing the key.
      pkLive: null,
    });
    expect(d1.inserts).toHaveLength(1);
    expect(d1.inserts[0]?.params).toEqual([
      "db_orders_tracker_a4f3b2",
      "user_42",
      "DATABASE_URL",
      "schema_v1",
    ]);
  });

  it("issues pg queries in the contract-mandated order", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const sqls = pg.calls.map((c) => c.sql);
    let i = 0;
    expect(sqls[i++]).toBe("BEGIN");
    // SK-HDC-010: 30s default cap immediately after BEGIN.
    expect(sqls[i++]).toBe("SET LOCAL statement_timeout = '30s'");
    expect(sqls[i++]).toMatch(/CREATE SCHEMA IF NOT EXISTS "orders_tracker_a4f3b2"/);
    expect(sqls[i++]).toMatch(/information_schema\.tables/);
    expect(sqls[i++]).toMatch(/CREATE ROLE/);
    expect(sqls[i++]).toMatch(/GRANT USAGE ON SCHEMA "orders_tracker_a4f3b2"/);
    // DDL is executed in the caller-supplied order. CREATE TABLEs
    // run under the 30s default; CREATE INDEX is bracketed by 600s
    // bumps per SK-HDC-010.
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
    expect(sqls[i++]).toBe("COMMIT");
    expect(sqls).toHaveLength(i);
  });

  it("parameterises sample-row INSERTs (no string interpolation of values)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const inserts = pg.calls.filter((c) => /^INSERT INTO/.test(c.sql));
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

    const policy = pg.calls.find((c) => /CREATE POLICY tenant_isolation/.test(c.sql));
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

    const policy = pg.calls.find((c) => /CREATE POLICY tenant_isolation/.test(c.sql));
    expect(policy?.sql).toContain("'anon:o''malley'");
  });
});

describe("provisionDb — failure paths", () => {
  it("schema already populated → rollback, schema_already_exists, no DDL executed", async () => {
    const pg = makePgStub();
    pg.setSchemaPopulated(true);
    const d1 = makeD1Stub();
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result).toEqual({
      ok: false,
      reason: "schema_already_exists",
      rolled_back: true,
    });
    const sqls = pg.calls.map((c) => c.sql);
    expect(sqls).toContain("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
    expect(sqls.some((s) => /CREATE TABLE/.test(s))).toBe(false);
    expect(sqls.some((s) => /CREATE ROLE/.test(s))).toBe(false);
    expect(sqls.some((s) => /CREATE POLICY/.test(s))).toBe(false);
    expect(d1.inserts).toHaveLength(0);
  });

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
    expect(pg.calls).toHaveLength(0);
    expect(d1.inserts).toHaveLength(0);
  });

  it("DDL failure on stmt 3 → ROLLBACK, ddl_execution_failed; D1 not written", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();
    pg.setFailOn((sql) => sql === args.ddl[2]);

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("ddl_execution_failed");
      expect(result.rolled_back).toBe(true);
    }
    const sqls = pg.calls.map((c) => c.sql);
    expect(sqls).toContain("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
    // DDL[0] and DDL[1] succeeded; DDL[3] never ran.
    expect(sqls).toContain(args.ddl[0]);
    expect(sqls).toContain(args.ddl[1]);
    expect(sqls).not.toContain(args.ddl[3]);
    expect(d1.inserts).toHaveLength(0);
  });

  it("sample-row INSERT failure → ROLLBACK, sample_insert_failed; D1 not written", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();
    pg.setFailOn((sql) => /^INSERT INTO "orders_tracker_a4f3b2"/.test(sql));

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("sample_insert_failed");
      expect(result.rolled_back).toBe(true);
    }
    const sqls = pg.calls.map((c) => c.sql);
    expect(sqls).toContain("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
    expect(d1.inserts).toHaveLength(0);
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
    const sqls = pg.calls.map((c) => c.sql);
    expect(sqls).toContain("COMMIT");
    expect(sqls.some((s) => /DROP SCHEMA "orders_tracker_a4f3b2" CASCADE/.test(s))).toBe(true);
  });

  it("DROP SCHEMA cleanup failure does not mask registry_insert_failed", async () => {
    const pg = makePgStub();
    pg.setFailOn((sql) => /^DROP SCHEMA/.test(sql));
    const d1 = makeD1Stub();
    d1.setInsertFails(true);
    const args = makeArgs();

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      // Original cause surfaces; cleanup error is swallowed so the
      // sweep job (docs/design.md §3.6.6) can pick up the orphan schema later.
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
    expect(pg.calls).toHaveLength(0);
  });

  it("rejects a dbId that produces an unsafe schema identifier", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    // Strip "db_" → schema name `bad"; DROP SCHEMA public; --` would
    // break out of the double-quoted form if not validated.
    const args = makeArgs({ dbId: 'db_bad"; DROP SCHEMA public; --' });

    await expect(provisionDb({ pg: pg.pg, d1: d1.d1 }, args)).rejects.toThrow(/unsafe schemaName/);
    expect(pg.calls).toHaveLength(0);
  });

  it("rejects a sample-row whose table contains a quote", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({
      plan: makePlan({
        sample_rows: [{ table: 'orders"; DROP TABLE x; --', values: { id: 1 } }],
      }),
    });

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("sample_insert_failed");
    }
    // Provisioner ROLLBACKed; no INSERT against the bad identifier landed.
    expect(pg.calls.some((c) => /DROP TABLE/.test(c.sql))).toBe(false);
  });

  it("rejects a sample-row whose column contains a quote", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs({
      plan: makePlan({
        sample_rows: [{ table: "orders", values: { 'evil"; --': 1 } }],
      }),
    });

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);
    expect(result.ok).toBe(false);
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

    const result = await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);
    expect(result.ok).toBe(false);
  });
});

describe("provisionDb — observability (GLOBAL-014, SK-OBS-005)", () => {
  it("emits a `db.transaction` span wrapping the BEGIN…COMMIT batch", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const spans = telemetry.spanExporter.getFinishedSpans();
    const txSpan = spans.find((s) => s.name === "db.transaction");
    expect(txSpan).toBeDefined();
    expect(txSpan?.attributes["db.system"]).toBe("postgresql");
  });

  it("emits a `db.query` span per Postgres statement (with db.operation derived)", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    const querySpans = telemetry.spanExporter
      .getFinishedSpans()
      .filter((s) => s.name === "db.query");
    // 16 pg.query() calls in the happy path: BEGIN, CREATE SCHEMA,
    // populated check, CREATE ROLE, GRANT, 4 DDL, 4 RLS, 2 INSERTs, COMMIT.
    expect(querySpans).toHaveLength(pg.calls.length);
    // Spot-check a few canonical operation names per OTel db.* semconv.
    const ops = querySpans.map((s) => s.attributes["db.operation"]);
    expect(ops).toContain("BEGIN");
    expect(ops).toContain("COMMIT");
    expect(ops).toContain("CREATE SCHEMA");
    expect(ops).toContain("INSERT");
  });

  it("marks the `db.transaction` span ERROR when a DDL statement throws", async () => {
    const pg = makePgStub();
    const d1 = makeD1Stub();
    const args = makeArgs();
    pg.setFailOn((sql) => sql === args.ddl[2]);

    await provisionDb({ pg: pg.pg, d1: d1.d1 }, args);

    // The DDL failure path returns a graceful error result; the
    // transaction span itself stays OK (the failure is caught and
    // converted to a result, not propagated). The failed `db.query`
    // span carries the exception.
    const failingQuerySpan = telemetry.spanExporter
      .getFinishedSpans()
      .find((s) => s.name === "db.query" && s.events.length > 0);
    expect(failingQuerySpan).toBeDefined();
    expect(failingQuerySpan?.events.some((e) => e.name === "exception")).toBe(true);
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
    expect(pg.calls).toHaveLength(0);
    expect(d1.inserts).toHaveLength(0);
  });
});
