import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresAdapter, type PostgresQueryFn } from "../src/index.ts";
import type { EnginePlan, Row } from "../src/types.ts";

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

// Helper: build a `postgres` plan from sql + params. Tests construct
// the plan inline (rather than re-deriving Engine literals everywhere).
function pgPlan(sql: string, params: unknown[] = []): EnginePlan {
  return { engine: "postgres", sql, params };
}

// Helper: drain an EngineResult into an array of rows.
async function drain(result: AsyncIterable<Row>): Promise<Row[]> {
  const rows: Row[] = [];
  for await (const row of result) rows.push(row);
  return rows;
}

describe("createPostgresAdapter", () => {
  it("returns rows from the injected query fn", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    const result = await db.execute(pgPlan("SELECT id, name FROM users WHERE id = $1", [1]));
    const rows = await drain(result);
    expect(rows).toEqual([{ id: 1, name: "alice" }]);
    expect(result.meta).toEqual({ engine: "postgres", command: "SELECT", rowCount: 1 });
  });

  it("emits a db.query span with db.system=postgresql and operation=SELECT", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute(pgPlan("SELECT 1"));
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span?.name).toBe("db.query");
    expect(span?.attributes["db.system"]).toBe("postgresql");
    expect(span?.attributes["db.operation"]).toBe("SELECT");
  });

  it.each([
    // DML
    ["INSERT INTO t (a) VALUES (1)", "INSERT"],
    ["update t SET a = 1", "UPDATE"],
    ["DELETE FROM t WHERE a = 1", "DELETE"],
    ["MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN UPDATE SET a = s.a", "MERGE"],
    // CTEs / set ops keep their actual leading keyword (OTel convention).
    ["WITH cte AS (SELECT 1) SELECT * FROM cte", "WITH"],
    // DDL — pair the verb with its target noun.
    ["CREATE TABLE foo (id INT)", "CREATE TABLE"],
    ["create  index idx_foo ON foo (id)", "CREATE INDEX"],
    ["DROP INDEX IF EXISTS idx_foo", "DROP INDEX"],
    ["ALTER TABLE foo ADD COLUMN b INT", "ALTER TABLE"],
    ["TRUNCATE TABLE foo", "TRUNCATE TABLE"],
    // Diagnostics + TCL + DCL.
    ["EXPLAIN ANALYZE SELECT * FROM foo", "EXPLAIN"],
    ["BEGIN", "BEGIN"],
    ["COMMIT", "COMMIT"],
    ["ROLLBACK", "ROLLBACK"],
    ["GRANT SELECT ON foo TO alice", "GRANT"],
    ["SHOW search_path", "SHOW"],
    ["SET search_path TO public", "SET"],
    // Comments and whitespace are stripped before tokenising.
    ["-- planner hint\n  SELECT 1", "SELECT"],
    ["/* leading block */ DROP TABLE foo", "DROP TABLE"],
    // Empty / non-keyword input falls back to UNKNOWN, not crash.
    ["", "UNKNOWN"],
    ["   ", "UNKNOWN"],
  ])("classifies %s as %s", async (sql, expected) => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute(pgPlan(sql));
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.attributes["db.operation"]).toBe(expected);
  });

  it("records nlqdb.db.duration_ms with operation label", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    await db.execute(pgPlan("SELECT 1"));
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
    await expect(db.execute(pgPlan("SELECT 1"))).rejects.toThrow("boom");
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });

  it("threads params through to the underlying query fn", async () => {
    let received: { sql: string; params: unknown[] } | null = null;
    const recordingQuery: PostgresQueryFn = async (sql, params) => {
      received = { sql, params };
      return { rows: [], rowCount: 0 };
    };
    const db = createPostgresAdapter({ query: recordingQuery });
    await db.execute(pgPlan("SELECT $1::int + $2::int", [2, 3]));
    expect(received).toEqual({ sql: "SELECT $1::int + $2::int", params: [2, 3] });
  });

  it("rejects plans whose `engine` does not match the adapter", async () => {
    const db = createPostgresAdapter({ query: okQuery });
    // The discriminated-union type prevents this at compile time; runtime
    // guard exists so the type narrowing is sound when callers cast.
    const wrongPlan = { engine: "clickhouse" } as unknown as EnginePlan;
    await expect(db.execute(wrongPlan)).rejects.toThrow(/non-postgres plan/);
  });

  // SK-MULTIENG-001: result is `AsyncIterable<Row> & { meta }`. The PG
  // adapter buffers rows in memory, so re-iterating yields the same
  // sequence — that's part of the contract for buffered engines.
  describe("EngineResult shape", () => {
    it("exposes rows via Symbol.asyncIterator and meta synchronously", async () => {
      const multiRow: PostgresQueryFn = async () => ({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        rowCount: 3,
        command: "SELECT",
        fields: [{ name: "id", dataTypeID: 23 }],
      });
      const db = createPostgresAdapter({ query: multiRow });
      const result = await db.execute(pgPlan("SELECT id FROM t"));

      expect(typeof result[Symbol.asyncIterator]).toBe("function");
      expect(result.meta).toEqual({
        engine: "postgres",
        command: "SELECT",
        rowCount: 3,
        fields: [{ name: "id", dataTypeID: 23 }],
      });

      const collected: Row[] = [];
      for await (const row of result) collected.push(row);
      expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("yields a fresh iterator per call so the buffered result is re-iterable", async () => {
      const db = createPostgresAdapter({ query: okQuery });
      const result = await db.execute(pgPlan("SELECT 1"));
      const first = await drain(result);
      const second = await drain(result);
      expect(first).toEqual(second);
    });

    it("derives meta.command from the engine response when present", async () => {
      const updateQuery: PostgresQueryFn = async () => ({
        rows: [],
        rowCount: 5,
        command: "UPDATE",
      });
      const db = createPostgresAdapter({ query: updateQuery });
      const result = await db.execute(pgPlan("UPDATE t SET a = 1"));
      expect(result.meta.engine).toBe("postgres");
      if (result.meta.engine === "postgres") {
        expect(result.meta.command).toBe("UPDATE");
        expect(result.meta.rowCount).toBe(5);
      }
    });

    it("falls back to the detected operation when the engine omits a command tag", async () => {
      const noCommand: PostgresQueryFn = async () => ({
        rows: [{ x: 1 }],
        rowCount: 1,
      });
      const db = createPostgresAdapter({ query: noCommand });
      const result = await db.execute(pgPlan("SELECT 1"));
      if (result.meta.engine === "postgres") {
        expect(result.meta.command).toBe("SELECT");
      }
    });
  });

  // Cancellation: the adapter must (a) surface a pre-aborted signal
  // before issuing the fetch, and (b) thread the live signal into the
  // underlying query fn so production wires it to Neon's
  // `fetchOptions.signal` and cancels the in-flight HTTP request.
  describe("AbortSignal cancellation", () => {
    it("throws AbortError before issuing the fetch when the signal is already aborted", async () => {
      let calls = 0;
      const countingQuery: PostgresQueryFn = async () => {
        calls++;
        return { rows: [], rowCount: 0 };
      };
      const db = createPostgresAdapter({ query: countingQuery });
      const controller = new AbortController();
      controller.abort(new Error("user cancelled"));
      await expect(db.execute(pgPlan("SELECT 1"), controller.signal)).rejects.toThrow(
        /user cancelled/,
      );
      expect(calls).toBe(0);
      const span = telemetry.spanExporter.getFinishedSpans()[0];
      expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
    });

    it("forwards the signal to the underlying query fn so production aborts the Neon fetch", async () => {
      let receivedSignal: AbortSignal | undefined;
      const capturingQuery: PostgresQueryFn = async (_sql, _params, signal) => {
        receivedSignal = signal;
        return { rows: [], rowCount: 0 };
      };
      const db = createPostgresAdapter({ query: capturingQuery });
      const controller = new AbortController();
      await db.execute(pgPlan("SELECT 1"), controller.signal);
      expect(receivedSignal).toBe(controller.signal);
    });

    it("surfaces a mid-flight abort by rethrowing the caller's reason", async () => {
      // Simulates a query that observes the signal mid-flight and
      // rejects with the signal's reason — the same behaviour Neon's
      // fetch-backed driver exhibits when the underlying request aborts.
      const abortingQuery: PostgresQueryFn = async (_sql, _params, signal) =>
        new Promise<{ rows: Row[]; rowCount?: number }>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason));
        });
      const db = createPostgresAdapter({ query: abortingQuery });
      const controller = new AbortController();
      const promise = db.execute(pgPlan("SELECT pg_sleep(60)"), controller.signal);
      controller.abort(new Error("client disconnected"));
      await expect(promise).rejects.toThrow(/client disconnected/);
      const span = telemetry.spanExporter.getFinishedSpans()[0];
      expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
    });
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
      await db.execute(pgPlan("SELECT 1"));
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)] ?? 0;
    expect(p50).toBeLessThan(150);
  });
});
