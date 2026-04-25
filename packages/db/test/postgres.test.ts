import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresAdapter, type PostgresQueryFn } from "../src/index.ts";

// PERFORMANCE §4 row 3: every Slice 3 call to the Postgres adapter MUST
// emit `db.query` (with `db.system=postgresql`, `db.operation=…`) and
// record `nlqdb.db.duration_ms{operation}`. CI fails this slice if
// either is missing or if measured p50 exceeds 1.5× the §2.1 budget.

let telemetry: TestTelemetry;

beforeEach(() => {
  telemetry = createTestTelemetry();
});

afterEach(() => {
  telemetry.reset();
});

const okQuery: PostgresQueryFn = async () => ({
  rows: [{ id: 1, name: "alice" }],
  rowCount: 1,
});

describe("createPostgresAdapter", () => {
  it("returns rows from the injected query fn", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    const result = await db.execute("SELECT id, name FROM users WHERE id = $1", [1]);
    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ id: 1, name: "alice" }]);
  });

  it("emits a db.query span with db.system=postgresql and operation=SELECT", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute("SELECT 1");
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span?.name).toBe("db.query");
    expect(span?.attributes["db.system"]).toBe("postgresql");
    expect(span?.attributes["db.operation"]).toBe("SELECT");
  });

  it.each([
    ["INSERT INTO t (a) VALUES (1)", "INSERT"],
    ["update t SET a = 1", "UPDATE"],
    ["DELETE FROM t WHERE a = 1", "DELETE"],
    ["WITH cte AS (SELECT 1) SELECT * FROM cte", "OTHER"],
  ])("classifies %s as %s", async (sql, expected) => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute(sql);
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.attributes["db.operation"]).toBe(expected);
  });

  it("records nlqdb.db.duration_ms with operation label", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute("SELECT 1");
    await telemetry.collectMetrics();
    const resourceMetrics = telemetry.metricExporter.getMetrics();
    const allMetrics = resourceMetrics.flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const histogram = allMetrics.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(histogram, "histogram nlqdb.db.duration_ms not found").toBeDefined();
    expect(histogram?.descriptor.unit).toBe("ms");
    const point = histogram?.dataPoints[0];
    expect(point?.attributes["operation"]).toBe("SELECT");
  });

  it("marks span ERROR and rethrows when the query rejects", async () => {
    const failingQuery: PostgresQueryFn = async () => {
      throw new Error("boom");
    };
    const db = createPostgresAdapter({ query: failingQuery });
    await expect(db.execute("SELECT 1")).rejects.toThrow("boom");
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });

  // PERFORMANCE §2.1 stage 6 budgets Neon HTTP at p50 100 ms / p99 350 ms.
  // The §4 rule: fail CI if measured p50 in the test exceeds 1.5× budget.
  // With the no-op query fn, we expect well under 10 ms — this catches
  // accidental synchronous overhead added by future instrumentation.
  it("p50 of N=20 calls stays under 1.5× §2.1 stage-6 budget (150 ms)", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await db.execute("SELECT 1");
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)] ?? 0;
    expect(p50).toBeLessThan(150);
  });
});
