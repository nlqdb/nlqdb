import { createTestTelemetry, type TestTelemetry } from "@nlqdb/otel/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTinybirdAdapter,
  TinybirdAuthError,
  type TinybirdHttpClient,
  TinybirdRateLimitError,
  TinybirdRequestError,
  TinybirdResponseParseError,
  TinybirdServerError,
  TinybirdValidationError,
} from "../src/clickhouse-tinybird/adapter.ts";
import { createValidator } from "../src/clickhouse-tinybird/validator.ts";
import type { EnginePlan, Row } from "../src/types.ts";

// `SK-MULTIENG-004`: every Tinybird call must emit `db.query` with
// `db.system="other_sql"`, `db.namespace=<workspace>`, and either
// `db.operation.name="PIPE_CALL"` (with `db.tinybird.pipe`) or the
// raw-SQL leading verb plus `db.query.text`. Latency lands in
// `nlqdb.db.duration_ms` with the same `operation` label as the PG
// adapter so dashboards aggregate cleanly across engines.

let telemetry: TestTelemetry;

beforeEach(() => {
  telemetry = createTestTelemetry();
});

afterEach(() => {
  telemetry.reset();
});

const ALLOWLIST = {
  pipes: ["events_per_day", "users_overview"],
  tables: ["events", "users", "tenant_a__events"],
};

const okPipeResponse = {
  meta: [
    { name: "day", type: "Date" },
    { name: "n", type: "UInt64" },
  ],
  data: [
    { day: "2026-01-01", n: 10 },
    { day: "2026-01-02", n: 12 },
  ],
  rows: 2,
  rows_before_limit_at_least: 2,
  statistics: { elapsed: 0.0023, rows_read: 100, bytes_read: 4096 },
  query_id: "qid_test_001",
};

const okPipeClient: TinybirdHttpClient = async () => okPipeResponse;

function pipePlan(name: string, params: Record<string, unknown> = {}): EnginePlan {
  return { engine: "clickhouse", pipe: name, params };
}

function sqlPlan(text: string): EnginePlan {
  return { engine: "clickhouse", sql: text };
}

async function drain(result: AsyncIterable<Row>): Promise<Row[]> {
  const out: Row[] = [];
  for await (const row of result) out.push(row);
  return out;
}

describe("createTinybirdAdapter — pipe path", () => {
  it("returns rows from the injected http client and surfaces meta", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    const result = await db.execute(pipePlan("events_per_day", { from: "2026-01-01" }));
    expect(await drain(result)).toEqual(okPipeResponse.data);
    expect(result.meta.engine).toBe("clickhouse");
    if (result.meta.engine === "clickhouse") {
      expect(result.meta.pipe).toBe("events_per_day");
      expect(result.meta.rowCount).toBe(2);
      expect(result.meta.fields).toEqual(okPipeResponse.meta);
      expect(result.meta.statistics).toEqual(okPipeResponse.statistics);
      expect(result.meta.queryId).toBe("qid_test_001");
    }
  });

  it("emits db.query with db.system=other_sql and db.operation.name=PIPE_CALL", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    await db.execute(pipePlan("events_per_day"));
    const spans = telemetry.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    const span = spans[0];
    expect(span?.name).toBe("db.query");
    expect(span?.attributes["db.system"]).toBe("other_sql");
    expect(span?.attributes["db.namespace"]).toBe("ws_test");
    expect(span?.attributes["db.operation.name"]).toBe("PIPE_CALL");
    expect(span?.attributes["db.tinybird.pipe"]).toBe("events_per_day");
    // Pipe SQL lives server-side; `db.query.text` is omitted for
    // pipe calls per `SK-MULTIENG-004`.
    expect(span?.attributes["db.query.text"]).toBeUndefined();
    expect(span?.attributes["db.tinybird.query_id"]).toBe("qid_test_001");
  });

  it("threads pipe params into the http client request payload", async () => {
    let received: { name: string; params: Record<string, unknown> } | null = null;
    const recording: TinybirdHttpClient = async (req) => {
      if (req.kind !== "pipe") throw new Error("expected pipe request");
      received = { name: req.name, params: req.params };
      return okPipeResponse;
    };
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: recording,
    });
    await db.execute(pipePlan("events_per_day", { from: "2026-01-01", limit: 7 }));
    expect(received).toEqual({
      name: "events_per_day",
      params: { from: "2026-01-01", limit: 7 },
    });
  });

  it("rejects pipes outside the allowlist with TinybirdValidationError", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    await expect(db.execute(pipePlan("not_in_allowlist"))).rejects.toBeInstanceOf(
      TinybirdValidationError,
    );
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });
});

describe("createTinybirdAdapter — raw SQL escape hatch", () => {
  const okSqlClient: TinybirdHttpClient = async () => ({
    meta: [{ name: "n", type: "UInt64" }],
    data: [{ n: 1 }],
    rows: 1,
    statistics: { elapsed: 0.0001, rows_read: 1, bytes_read: 8 },
  });

  it("emits db.query.text and the SQL leading verb on the span", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okSqlClient,
    });
    await db.execute(sqlPlan("SELECT count(*) FROM events"));
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.attributes["db.system"]).toBe("other_sql");
    expect(span?.attributes["db.namespace"]).toBe("ws_test");
    expect(span?.attributes["db.operation.name"]).toBe("SELECT");
    expect(span?.attributes["db.query.text"]).toBe("SELECT count(*) FROM events");
    // Pipe attribute is only set when the call is `PIPE_CALL`.
    expect(span?.attributes["db.tinybird.pipe"]).toBeUndefined();
  });

  it("returns rows for an allowlisted SELECT", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okSqlClient,
    });
    const result = await db.execute(sqlPlan("SELECT count(*) FROM events"));
    expect(await drain(result)).toEqual([{ n: 1 }]);
    if (result.meta.engine === "clickhouse") {
      expect(result.meta.pipe).toBeUndefined();
    }
  });

  it("rejects DDL/DML verbs at the leading-verb gate", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okSqlClient,
    });
    await expect(db.execute(sqlPlan("DROP TABLE events"))).rejects.toBeInstanceOf(
      TinybirdValidationError,
    );
    await expect(db.execute(sqlPlan("INSERT INTO events VALUES (1)"))).rejects.toBeInstanceOf(
      TinybirdValidationError,
    );
  });

  it("rejects references to tables outside the allowlist", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okSqlClient,
    });
    await expect(db.execute(sqlPlan("SELECT 1 FROM other_table"))).rejects.toThrow(
      /table_not_allowed|not_allowed/,
    );
  });

  it("rejects cross-prefix references with cross_prefix_reference", async () => {
    // Allowlist has `tenant_a__events`; tenant B's adapter must reject
    // a query that crosses into A's prefix.
    const tenantB = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: { pipes: ["events_per_day"], tables: ["tenant_b__events"] },
      httpClient: okSqlClient,
    });
    try {
      await tenantB.execute(sqlPlan("SELECT 1 FROM tenant_a__events"));
      expect.unreachable("expected cross-prefix rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(TinybirdValidationError);
      expect((err as TinybirdValidationError).reason).toBe("cross_prefix_reference");
      expect((err as TinybirdValidationError).matched).toBe("tenant_a__events");
    }
  });

  it("rejects a SQL plan when parsing fails", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okSqlClient,
    });
    // Malformed SQL with an allowlisted leading verb passes the
    // gate but fails the AST parse — must reject, not fall through.
    await expect(db.execute(sqlPlan("SELECT FROM"))).rejects.toThrow(/parse_failed/);
  });
});

describe("createTinybirdAdapter — invariants", () => {
  it("rejects plans that target a different engine", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    const wrong = { engine: "postgres", sql: "SELECT 1" } as unknown as EnginePlan;
    await expect(db.execute(wrong)).rejects.toThrow(/non-clickhouse plan/);
  });

  it("rejects plans that supply both `pipe` and `sql`", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    const ambiguous: EnginePlan = {
      engine: "clickhouse",
      pipe: "events_per_day",
      sql: "SELECT 1 FROM events",
    };
    await expect(db.execute(ambiguous)).rejects.toThrow(/exactly one/);
  });

  it("rejects plans that supply neither `pipe` nor `sql`", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    const empty: EnginePlan = { engine: "clickhouse" };
    await expect(db.execute(empty)).rejects.toThrow(/exactly one/);
  });

  it("records nlqdb.db.duration_ms with operation=PIPE_CALL on pipe calls", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    await db.execute(pipePlan("events_per_day"));
    await telemetry.collectMetrics();
    const all = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const histogram = all.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(histogram, "histogram nlqdb.db.duration_ms not found").toBeDefined();
    expect(histogram?.descriptor.unit).toBe("ms");
    const point = histogram?.dataPoints.at(-1);
    expect(point?.attributes["operation"]).toBe("PIPE_CALL");
  });
});

describe("createTinybirdAdapter — AbortSignal cancellation", () => {
  it("throws before issuing the http request when the signal is already aborted", async () => {
    let calls = 0;
    const counting: TinybirdHttpClient = async () => {
      calls++;
      return okPipeResponse;
    };
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: counting,
    });
    const controller = new AbortController();
    controller.abort(new Error("user cancelled"));
    await expect(db.execute(pipePlan("events_per_day"), controller.signal)).rejects.toThrow(
      /user cancelled/,
    );
    expect(calls).toBe(0);
    const span = telemetry.spanExporter.getFinishedSpans()[0];
    expect(span?.status.code).toBe(2 /* SpanStatusCode.ERROR */);
  });

  it("forwards the signal to the http client so production aborts the fetch", async () => {
    let received: AbortSignal | undefined;
    const capturing: TinybirdHttpClient = async (_req, signal) => {
      received = signal;
      return okPipeResponse;
    };
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: capturing,
    });
    const controller = new AbortController();
    await db.execute(pipePlan("events_per_day"), controller.signal);
    expect(received).toBe(controller.signal);
  });

  it("surfaces a mid-flight abort by rethrowing the caller's reason", async () => {
    const aborting: TinybirdHttpClient = (_req, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason));
      });
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: aborting,
    });
    const controller = new AbortController();
    const promise = db.execute(pipePlan("events_per_day"), controller.signal);
    controller.abort(new Error("client disconnected"));
    await expect(promise).rejects.toThrow(/client disconnected/);
  });
});

describe("validator round-trip", () => {
  const validator = createValidator(ALLOWLIST);

  it("rejects multi-statement input that smuggles a DROP after a SELECT", () => {
    // Bypass #1 from the PR review — node-sql-parser returns an array
    // of ASTs for `;`-separated input; the second statement must reject
    // even though `events` is allowlisted.
    const got = validator({
      kind: "sql",
      text: "SELECT 1 FROM events; DROP TABLE events",
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.reason).toBe("non_select_statement");
    }
  });

  it("rejects WITH cte AS (DELETE FROM x) SELECT 1 — embedded destructive verb", () => {
    const got = validator({
      kind: "sql",
      text: "WITH cte AS (DELETE FROM events) SELECT 1",
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      // node-sql-parser may either reject the CTE-with-DELETE at parse
      // time (parse_failed) or surface it as an embedded reject; either
      // closes the bypass.
      expect(["embedded_destructive_verb", "parse_failed", "non_select_statement"]).toContain(
        got.reason,
      );
    }
  });

  it("rejects UNION with embedded INSERT", () => {
    // Some dialects parse `SELECT … UNION INSERT …` as a parse error;
    // others as a UNION node with an INSERT branch. Either rejection
    // path closes the bypass.
    const got = validator({
      kind: "sql",
      text: "SELECT 1 FROM events UNION INSERT INTO events VALUES (1)",
    });
    expect(got.ok).toBe(false);
  });

  it("rejects schema-qualified cross-tenant reference (other.events)", () => {
    // Bypass #2 — `analytics.events` AST shape is `{db:"other",
    // table:"events"}`; the bare-name walk would let it through.
    const got = validator({ kind: "sql", text: "SELECT 1 FROM other.events" });
    expect(got).toEqual({
      ok: false,
      reason: "cross_prefix_reference",
      matched: "other.events",
    });
  });

  it("accepts schema-qualified reference when `<db>.<table>` is in the allowlist", () => {
    const validatorWithQualified = createValidator({
      pipes: [],
      tables: ["analytics.events"],
    });
    expect(validatorWithQualified({ kind: "sql", text: "SELECT 1 FROM analytics.events" })).toEqual(
      { ok: true },
    );
  });

  it("still accepts bare-name allowlisted tables (no schema qualifier)", () => {
    expect(validator({ kind: "sql", text: "SELECT 1 FROM events" })).toEqual({ ok: true });
  });

  it("accepts allowlisted Pipes and rejects others", () => {
    expect(validator({ kind: "pipe", name: "events_per_day" })).toEqual({ ok: true });
    expect(validator({ kind: "pipe", name: "users_overview" })).toEqual({ ok: true });
    expect(validator({ kind: "pipe", name: "anything_else" })).toEqual({
      ok: false,
      reason: "pipe_not_allowed",
      matched: "anything_else",
    });
  });

  it("accepts SELECT/WITH and rejects every other leading verb", () => {
    expect(validator({ kind: "sql", text: "SELECT 1 FROM events" })).toEqual({
      ok: true,
    });
    expect(
      validator({
        kind: "sql",
        text: "WITH x AS (SELECT 1 FROM events) SELECT * FROM x",
      }),
    ).toEqual({ ok: true });
    for (const sql of [
      "INSERT INTO events VALUES (1)",
      "UPDATE events SET a = 1",
      "DELETE FROM events",
      "DROP TABLE events",
      "ALTER TABLE events ADD COLUMN x Int64",
      "TRUNCATE TABLE events",
      "GRANT SELECT ON events TO alice",
    ]) {
      const got = validator({ kind: "sql", text: sql });
      expect(got.ok, `expected reject for: ${sql}`).toBe(false);
    }
  });

  it("flags `<prefix>__<rest>` references outside the allowlist as cross_prefix", () => {
    const got = validator({
      kind: "sql",
      text: "SELECT 1 FROM tenant_z__events",
    });
    expect(got).toEqual({
      ok: false,
      reason: "cross_prefix_reference",
      matched: "tenant_z__events",
    });
  });

  it("flags non-prefixed unknown tables as table_not_allowed", () => {
    const got = validator({ kind: "sql", text: "SELECT 1 FROM unknown" });
    expect(got).toEqual({
      ok: false,
      reason: "table_not_allowed",
      matched: "unknown",
    });
  });

  it("rejects empty input on both modes", () => {
    expect(validator({ kind: "sql", text: "  " })).toEqual({ ok: false, reason: "empty" });
    expect(validator({ kind: "pipe", name: "" })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("createTinybirdAdapter — wire payload hygiene", () => {
  it("trims a trailing `;` before appending FORMAT JSON", async () => {
    // Bypass #4 — the production fetch client builds the body string;
    // exercise it via the global `fetch` mock so we can inspect the
    // serialised body. Anything other than `... FROM events FORMAT
    // JSON` would let format-injection ride on a trailing semicolon.
    const calls: Array<{ url: string; body: string }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response(JSON.stringify({ data: [], rows: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    try {
      const db = createTinybirdAdapter({
        token: "test_token",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      await db.execute(sqlPlan("SELECT 1 FROM events;"));
      expect(calls).toHaveLength(1);
      const body = JSON.parse(calls[0]?.body ?? "{}") as { q?: string };
      expect(body.q).toBe("SELECT 1 FROM events FORMAT JSON");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("createTinybirdAdapter — typed HTTP errors", () => {
  function buildClientWith(status: number, body = "", headers: Record<string, string> = {}) {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(body, {
        status,
        headers: { "content-type": "application/json", ...headers },
      })) as unknown as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  it("maps 401 to TinybirdAuthError with a hint", async () => {
    const restore = buildClientWith(401, '{"error": "invalid token"}');
    try {
      const db = createTinybirdAdapter({
        token: "bad",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      try {
        await db.execute(pipePlan("events_per_day"));
        expect.unreachable("expected auth rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(TinybirdAuthError);
        expect((err as TinybirdAuthError).statusCode).toBe(401);
        expect((err as TinybirdAuthError).hint).toMatch(/TINYBIRD_TOKEN/);
      }
    } finally {
      restore();
    }
  });

  it("maps 429 to TinybirdRateLimitError carrying Retry-After seconds", async () => {
    const restore = buildClientWith(429, '{"error": "rate limited"}', {
      "retry-after": "42",
    });
    try {
      const db = createTinybirdAdapter({
        token: "ok",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      try {
        await db.execute(pipePlan("events_per_day"));
        expect.unreachable("expected rate-limit rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(TinybirdRateLimitError);
        expect((err as TinybirdRateLimitError).retryAfterSeconds).toBe(42);
      }
      const span = telemetry.spanExporter.getFinishedSpans()[0];
      expect(span?.attributes["nlqdb.tinybird.retry_after_s"]).toBe(42);
    } finally {
      restore();
    }
  });

  it("maps 5xx to TinybirdServerError", async () => {
    const restore = buildClientWith(503, "service unavailable");
    try {
      const db = createTinybirdAdapter({
        token: "ok",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      await expect(db.execute(pipePlan("events_per_day"))).rejects.toBeInstanceOf(
        TinybirdServerError,
      );
    } finally {
      restore();
    }
  });

  it("maps other 4xx to TinybirdRequestError", async () => {
    const restore = buildClientWith(400, "bad request");
    try {
      const db = createTinybirdAdapter({
        token: "ok",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      await expect(db.execute(pipePlan("events_per_day"))).rejects.toBeInstanceOf(
        TinybirdRequestError,
      );
    } finally {
      restore();
    }
  });

  it("wraps malformed JSON with TinybirdResponseParseError", async () => {
    const restore = buildClientWith(200, "<html>not json</html>");
    try {
      const db = createTinybirdAdapter({
        token: "ok",
        workspace: "ws_test",
        allowlist: ALLOWLIST,
      });
      try {
        await db.execute(pipePlan("events_per_day"));
        expect.unreachable("expected parse error");
      } catch (err) {
        expect(err).toBeInstanceOf(TinybirdResponseParseError);
        expect((err as TinybirdResponseParseError).bodySnippet.length).toBeLessThanOrEqual(200);
      }
    } finally {
      restore();
    }
  });
});

describe("createTinybirdAdapter — AbortError histogram outcome", () => {
  it("labels the duration sample with outcome=aborted when the call aborts", async () => {
    const aborting: TinybirdHttpClient = (_req, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const err = new Error("cancelled");
          err.name = "AbortError";
          reject(err);
        });
      });
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: aborting,
    });
    const controller = new AbortController();
    const promise = db.execute(pipePlan("events_per_day"), controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
    await telemetry.collectMetrics();
    const all = telemetry.metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics));
    const histogram = all.find((m) => m.descriptor.name === "nlqdb.db.duration_ms");
    expect(histogram).toBeDefined();
    const point = histogram?.dataPoints.at(-1);
    expect(point?.attributes["outcome"]).toBe("aborted");
  });
});

// PERFORMANCE budget: the adapter (with stub HTTP) must add negligible
// overhead. The Tinybird HTTP API itself is the real network cost; this
// guard only catches accidental synchronous overhead added by future
// instrumentation. Threshold matches the PG suite's 150 ms ceiling so
// future regressions show up the same way regardless of engine.
describe("createTinybirdAdapter — performance guard", () => {
  it("p99 of N=20 calls stays under 200 ms on the stub fixture", async () => {
    const db = createTinybirdAdapter({
      workspace: "ws_test",
      allowlist: ALLOWLIST,
      httpClient: okPipeClient,
    });
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await db.execute(pipePlan("events_per_day"));
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    // p99 of 20 samples = the largest sample (index 19). For this stub
    // we expect well under 10 ms; budget is 200 ms per acceptance.
    const p99 = samples[samples.length - 1] ?? 0;
    expect(p99).toBeLessThan(200);
  });
});
