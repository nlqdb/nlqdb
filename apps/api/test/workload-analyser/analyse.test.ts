// Pure-analyser fixtures — fixed-frame inputs → expected `ReshapeProposal[]`.
// `SK-MIGRATE-002`: thresholds are pinned constants, so behaviour is
// fully deterministic against the constants in `policy.ts`.

import { describe, expect, it } from "vitest";
import {
  analyseQueryLog,
  pipeNameFor,
  type QueryLogRow,
} from "../../src/workload-analyser/analyse.ts";
import { POLICY } from "../../src/workload-analyser/policy.ts";

const DAY_MS = 86_400_000;
const BASE_TS = Date.UTC(2026, 4, 1, 12, 0, 0); // 2026-05-01T12:00:00Z

function row(overrides: Partial<QueryLogRow> = {}): QueryLogRow {
  return {
    eventId: overrides.eventId ?? `ev_${Math.random().toString(36).slice(2)}`,
    dbId: overrides.dbId ?? "db_alpha",
    schemaHash: overrides.schemaHash ?? "sh_alpha",
    queryHash: overrides.queryHash ?? "qh_top10",
    planShape: overrides.planShape ?? "ps_alpha",
    engine: overrides.engine ?? "clickhouse",
    orchestratorMs: overrides.orchestratorMs ?? 600,
    rowsReturned: overrides.rowsReturned ?? 100,
    ts: overrides.ts ?? BASE_TS,
  };
}

// Generate `n` rows spread across `daySpread` distinct UTC days, each
// with a `latencyMs` payload. Each row gets a unique eventId so dedup
// is a no-op (tests targeting dedup behaviour pass eventIds explicitly).
function rows(
  n: number,
  daySpread: number,
  latencyMs: number,
  overrides: Partial<QueryLogRow> = {},
): QueryLogRow[] {
  const out: QueryLogRow[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(
      row({
        ...overrides,
        eventId: `ev_${i}`,
        orchestratorMs: latencyMs,
        ts: BASE_TS + (i % daySpread) * DAY_MS,
      }),
    );
  }
  return out;
}

describe("analyseQueryLog", () => {
  it("hot ClickHouse fingerprint clears all three thresholds and emits clickhouse_pipe_create", () => {
    const out = analyseQueryLog(rows(30, 7, 800), POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "clickhouse_pipe_create",
      dbId: "db_alpha",
      schemaHash: "sh_alpha",
      queryHash: "qh_top10",
      stats: { calls: 30, p99Ms: 800, distinctDays: 7 },
    });
    if (out[0]?.kind === "clickhouse_pipe_create") {
      expect(out[0].pipeName).toMatch(/^nlqdb_w5__sh_[a-z0-9]+__qh_[a-z0-9]+$/);
    }
  });

  it("hot Postgres fingerprint emits pg_add_column_suggestion (advisory; no DDL kind)", () => {
    const out = analyseQueryLog(rows(30, 3, 700, { engine: "postgres", dbId: "db_pg" }), POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("pg_add_column_suggestion");
    expect(out[0]).toMatchObject({
      dbId: "db_pg",
      stats: { calls: 30, p99Ms: 700, distinctDays: 3 },
    });
    // pg_add_column_suggestion has no `pipeName` field.
    expect((out[0] as Record<string, unknown>)["pipeName"]).toBeUndefined();
  });

  it("cold fingerprint (5 calls) is filtered — call gate", () => {
    expect(analyseQueryLog(rows(5, 2, 1000), POLICY)).toEqual([]);
  });

  it("just-below-threshold (24 calls) is filtered — strict ≥25", () => {
    expect(analyseQueryLog(rows(24, 7, 800), POLICY)).toEqual([]);
  });

  it("p99 below 500ms is filtered even with high call count", () => {
    expect(analyseQueryLog(rows(50, 7, 499), POLICY)).toEqual([]);
  });

  it("p99 exactly 500ms passes (gate is `≥ MIN_P99_MS`)", () => {
    const out = analyseQueryLog(rows(30, 7, 500), POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.stats.p99Ms).toBe(500);
  });

  it("empty input yields empty proposals", () => {
    expect(analyseQueryLog([], POLICY)).toEqual([]);
  });

  it("dedupes by eventId so transport-layer redelivery is a no-op", () => {
    // Cloudflare Queues redelivers on retry; same event_id reaches the
    // analyser twice. Without dedup, a 12-call group with 12 redeliveries
    // would falsely promote.
    const half = rows(12, 6, 800).map((r, i) => ({ ...r, eventId: `ev_${i}` }));
    const dupes = [...half, ...half];
    expect(analyseQueryLog(dupes, POLICY)).toEqual([]);
  });

  it("pipeNameFor is deterministic for identical (schema_hash, query_hash) inputs", () => {
    expect(pipeNameFor("sh_x", "qh_y")).toBe(pipeNameFor("sh_x", "qh_y"));
    expect(pipeNameFor("sh_x", "qh_y")).not.toBe(pipeNameFor("sh_x", "qh_z"));
  });

  it("groups by (db_id, schema_hash, query_hash) — same query under different dbs is two proposals", () => {
    const a = rows(30, 7, 600, { dbId: "db_a" });
    const b = rows(30, 7, 600, { dbId: "db_b" });
    // Override eventIds so combining the two arrays doesn't dedupe across dbs.
    const tagged = [
      ...a.map((r, i) => ({ ...r, eventId: `a_${i}` })),
      ...b.map((r, i) => ({ ...r, eventId: `b_${i}` })),
    ];
    const out = analyseQueryLog(tagged, POLICY);
    expect(out).toHaveLength(2);
    const dbs = new Set(out.map((p) => p.dbId));
    expect(dbs).toEqual(new Set(["db_a", "db_b"]));
  });

  it("multiple engines in one window emit the right kind per group", () => {
    const ch = rows(30, 3, 700, { dbId: "db_ch", engine: "clickhouse" });
    const pg = rows(30, 3, 700, { dbId: "db_pg", engine: "postgres" });
    const out = analyseQueryLog(
      [
        ...ch.map((r, i) => ({ ...r, eventId: `ch_${i}` })),
        ...pg.map((r, i) => ({ ...r, eventId: `pg_${i}` })),
      ],
      POLICY,
    );
    expect(out).toHaveLength(2);
    const kinds = out.map((p) => p.kind).sort();
    expect(kinds).toEqual(["clickhouse_pipe_create", "pg_add_column_suggestion"]);
  });

  it("p99 nearest-rank picks the top latency for a 30-row distribution", () => {
    // 29 rows at 100ms + 1 at 5000ms — p99 must surface the tail.
    const baseRows = rows(29, 7, 100).map((r, i) => ({ ...r, eventId: `e_${i}` }));
    const tail = row({ eventId: "e_tail", orchestratorMs: 5000 });
    const out = analyseQueryLog([...baseRows, tail], POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.stats.p99Ms).toBe(5000);
    expect(out[0]?.stats.calls).toBe(30);
  });

  it("distinct UTC-day count is computed from `ts` rather than `eventId`", () => {
    // 30 rows all at the same UTC ms — calls=30, distinctDays=1, p99=800.
    // MIN_DISTINCT_DAYS=1 lets it through (recommendation; future SK can
    // tighten to ≥2).
    const allOnOneDay = rows(30, 1, 800);
    const out = analyseQueryLog(allOnOneDay, POLICY);
    expect(out).toHaveLength(1);
    expect(out[0]?.stats.distinctDays).toBe(1);
  });

  it("zero distinct days (empty group post-dedup) yields no proposal", () => {
    // Synthetic edge — 30 rows all sharing the same eventId. After dedup
    // the group has 1 row, calls=1 < MIN_CALLS, so the group is filtered
    // by the calls gate (distinctDays gate is downstream).
    const allSame = rows(30, 7, 800).map((r) => ({ ...r, eventId: "single_id" }));
    expect(analyseQueryLog(allSame, POLICY)).toEqual([]);
  });
});
