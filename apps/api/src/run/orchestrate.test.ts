// `/v1/run` orchestrator unit tests — stub deps, no Workers env.
// Covers the SK-SDK-009 contract: same SQL allow-list as `/v1/ask`,
// pk_live read-only enforcement (SK-APIKEYS-003), trace block shape
// (SK-TRUST-002), DB-not-found / unreachable / config-error mapping.

import { describe, expect, it, vi } from "vitest";

import { DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import { orchestrateRun, type RunDeps } from "./orchestrate.ts";

function makeDb(overrides: Partial<DbRecord> = {}): DbRecord {
  return {
    id: "db_test",
    tenantId: "user_1",
    engine: "postgres",
    connectionSecretRef: "NEON_DB_TEST",
    schemaHash: "abc123",
    schemaText: "CREATE TABLE orders (id int);",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  return {
    resolveDb: async () => makeDb(),
    exec: async () => ({ rows: [{ a: 1 }], rowCount: 1 }) satisfies QueryResult,
    rateLimiter: { check: async () => ({ allowed: true, count: 1, limit: 60, resetAt: 0 }) },
    ...overrides,
  };
}

describe("orchestrateRun", () => {
  it("returns rows + a SK-TRUST-002 trace block on the happy path", async () => {
    const deps = makeDeps({
      exec: async () => ({ rows: [{ count: 7 }], rowCount: 1 }),
    });
    const out = await orchestrateRun(deps, {
      sql: "SELECT COUNT(*) FROM orders",
      dbId: "db_test",
      userId: "user_1",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.rows).toEqual([{ count: 7 }]);
    expect(out.result.rowCount).toBe(1);
    expect(out.result.trace.model).toBe("raw");
    expect(out.result.trace.confidence).toBe(1.0);
    expect(out.result.trace.cache_hit).toBe(false);
    expect(out.result.trace.sql).toBe("SELECT COUNT(*) FROM orders");
    expect(out.result.trace.plan_id).toMatch(/^abc123:[0-9a-f]{64}$/);
  });

  it("rejects DDL via the shared SQL allow-list", async () => {
    const exec = vi.fn();
    const out = await orchestrateRun(makeDeps({ exec }), {
      sql: "DROP TABLE orders",
      dbId: "db_test",
      userId: "user_1",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("sql_rejected");
    if (out.error.status !== "sql_rejected") return;
    expect(out.error.reason).toBe("drop_statement");
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects CTE-embedded DROP (defense matches the /v1/ask validator)", async () => {
    const out = await orchestrateRun(makeDeps(), {
      sql: "WITH x AS (DROP TABLE orders) SELECT 1",
      dbId: "db_test",
      userId: "user_1",
    });
    expect(out.ok).toBe(false);
  });

  it("rejects writes when the principal is read-only (pk_live)", async () => {
    const exec = vi.fn();
    const out = await orchestrateRun(makeDeps({ exec }), {
      sql: "UPDATE orders SET paid = true WHERE id = 1",
      dbId: "db_test",
      userId: "user_1",
      readOnly: true,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("forbidden");
    if (out.error.status !== "forbidden") return;
    expect(out.error.reason).toBe("read_only_principal");
    expect(exec).not.toHaveBeenCalled();
  });

  it("allows reads for read-only principals", async () => {
    const out = await orchestrateRun(makeDeps(), {
      sql: "SELECT * FROM orders",
      dbId: "db_test",
      userId: "user_1",
      readOnly: true,
    });
    expect(out.ok).toBe(true);
  });

  it("read-only gate strips leading comments before the verb check (no /* */ smuggling)", async () => {
    const exec = vi.fn();
    const out = await orchestrateRun(makeDeps({ exec }), {
      sql: "/* sneaky */ INSERT INTO orders VALUES (1)",
      dbId: "db_test",
      userId: "user_1",
      readOnly: true,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("forbidden");
    expect(exec).not.toHaveBeenCalled();
  });

  it("read-only gate also strips -- line comments before the verb check", async () => {
    const exec = vi.fn();
    const out = await orchestrateRun(makeDeps({ exec }), {
      sql: "-- comment\nUPDATE orders SET paid = true WHERE id = 1",
      dbId: "db_test",
      userId: "user_1",
      readOnly: true,
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("forbidden");
    expect(exec).not.toHaveBeenCalled();
  });

  it("returns db_not_found when resolveDb returns null", async () => {
    const out = await orchestrateRun(makeDeps({ resolveDb: async () => null }), {
      sql: "SELECT 1",
      dbId: "db_missing",
      userId: "user_1",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("db_not_found");
  });

  it("returns schema_unavailable when the row carries a null schemaHash", async () => {
    const out = await orchestrateRun(
      makeDeps({ resolveDb: async () => makeDb({ schemaHash: null }) }),
      { sql: "SELECT 1", dbId: "db_test", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("schema_unavailable");
  });

  it("returns rate_limited when the limiter rejects", async () => {
    const out = await orchestrateRun(
      makeDeps({
        rateLimiter: {
          check: async () => ({ allowed: false, count: 61, limit: 60, resetAt: 9999 }),
        },
      }),
      { sql: "SELECT 1", dbId: "db_test", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("rate_limited");
    if (out.error.status !== "rate_limited") return;
    expect(out.error.limit).toBe(60);
    expect(out.error.count).toBe(61);
    expect(out.error.resetAt).toBe(9999);
  });

  it("maps DbConfigError to db_misconfigured (operator-config, not transient)", async () => {
    const out = await orchestrateRun(
      makeDeps({
        exec: async () => {
          throw new DbConfigError("missing secret");
        },
      }),
      { sql: "SELECT 1", dbId: "db_test", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("db_misconfigured");
  });

  it("maps generic exec throws to db_unreachable (transient infra)", async () => {
    const out = await orchestrateRun(
      makeDeps({
        exec: async () => {
          throw new Error("connection reset");
        },
      }),
      { sql: "SELECT 1", dbId: "db_test", userId: "user_1" },
    );
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.status).toBe("db_unreachable");
  });

  it("uses the supplied rateLimitBucketKey instead of userId when present", async () => {
    const check = vi.fn(async () => ({ allowed: true, count: 1, limit: 60, resetAt: 0 }));
    await orchestrateRun(makeDeps({ rateLimiter: { check } }), {
      sql: "SELECT 1",
      dbId: "db_test",
      userId: "user_1",
      rateLimitBucketKey: "rl:key_42",
    });
    expect(check).toHaveBeenCalledWith("rl:key_42");
  });

  it("falls back to userId when rateLimitBucketKey is omitted", async () => {
    const check = vi.fn(async () => ({ allowed: true, count: 1, limit: 60, resetAt: 0 }));
    await orchestrateRun(makeDeps({ rateLimiter: { check } }), {
      sql: "SELECT 1",
      dbId: "db_test",
      userId: "user_1",
    });
    expect(check).toHaveBeenCalledWith("user_1");
  });
});
