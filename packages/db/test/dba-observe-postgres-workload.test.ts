import { describe, expect, it } from "vitest";
import {
  type FingerprintWindow,
  observePostgresWorkload,
  type StatementSnapshot,
  statementWindow,
} from "../src/index.ts";
import type { PostgresQueryFn } from "../src/postgres.ts";

// Counters for `calls` runs of `times` ms each, as pg_stat_statements keeps them.
const counters = (query: string, times: number[]) => {
  const calls = times.length;
  const totalMs = times.reduce((s, t) => s + t, 0);
  return { query, calls, totalMs, sumSquaresMs: times.reduce((s, t) => s + t * t, 0) };
};

describe("statementWindow", () => {
  it("diffs cumulative counters into a per-window mean and mean + 1.65 σ p95 estimate", () => {
    const before: StatementSnapshot = new Map([["1", counters("q1", [100, 100])]]);
    const after: StatementSnapshot = new Map([
      ["1", counters("q1", [100, 100, 1, 3])],
      ["2", counters("q2", [5])],
      ["3", counters("q3", [])],
    ]);
    // Most total time first; q3 didn't run in the window.
    const [q2, q1, ...rest] = statementWindow(before, after);
    // q2 is new, so it counts from zero.
    expect(q2).toMatchObject({ fingerprint: "2", calls: 1, meanMs: 5, p95EstimateMs: 5 });
    // q1's window is [1, 3]: mean 2, σ 1.
    expect(q1).toMatchObject({ fingerprint: "1", calls: 2, meanMs: 2 });
    expect(q1?.p95EstimateMs).toBeCloseTo(3.65);
    expect(rest).toEqual([]);
  });

  it("counts from zero after a stats reset", () => {
    const before: StatementSnapshot = new Map([["1", counters("q", [1, 1, 1])]]);
    const after: StatementSnapshot = new Map([["1", counters("q", [4])]]);
    expect(statementWindow(before, after)[0]).toMatchObject({ calls: 1, totalMs: 4 });
  });
});

const window = (query: string, totalMs = 100): FingerprintWindow => ({
  fingerprint: "42",
  query,
  calls: 50,
  totalMs,
  meanMs: totalMs / 50,
  p95EstimateMs: totalMs / 25,
});

// A stub that answers EXPLAIN with `plan` and the table check with `table`.
function stub(plan: unknown, table: Record<string, number>) {
  const sqls: string[] = [];
  const query: PostgresQueryFn = async (sql) => {
    sqls.push(sql);
    if (sql.startsWith("EXPLAIN"))
      return { rows: [{ "QUERY PLAN": JSON.stringify([{ Plan: plan }]) }] };
    return { rows: [table] };
  };
  return { query, sqls };
}

const seqScan = (filter: string, planRows = 1) => ({
  "Node Type": "Seq Scan",
  "Relation Name": "users",
  Schema: "app",
  "Plan Rows": planRows,
  Filter: filter,
});
const bigTable = { row_estimate: 10_000, table_bytes: 1e6, known_columns: 2, covered: 0 };

describe("observePostgresWorkload", () => {
  it("proposes the AND of equality columns of a nested seq scan, with the fingerprint as evidence", async () => {
    const { query } = stub(
      { "Node Type": "Limit", Plans: [seqScan(`((u.org_id = $1) AND (u."Email" = ($2)::text))`)] },
      bigTable,
    );
    const [p, ...rest] = await observePostgresWorkload(query, "app", [
      window('SELECT * FROM users u WHERE org_id = $1 AND "Email" = $2'),
    ]);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ tier: 1, table: "users", columns: ["org_id", "Email"] });
    expect(p?.evidence.workload).toMatchObject({ fingerprint: "42", calls: 50 });
  });

  it.each([
    ["an OR filter", seqScan("((u.a = $1) OR (u.b = $2))"), bigTable],
    ["a non-equality filter", seqScan("(u.a > $1)"), bigTable],
    ["an unselective filter", seqScan("(u.a = $1)", 2_000), bigTable],
    ["an already covered column set", seqScan("(u.a = $1)"), { ...bigTable, covered: 1 }],
    ["another schema", { ...seqScan("(u.a = $1)"), Schema: "other" }, bigTable],
  ])("proposes nothing for %s", async (_, plan, table) => {
    const { query } = stub(plan, { ...table, known_columns: 1 });
    expect(await observePostgresWorkload(query, "app", [window("SELECT 1")])).toEqual([]);
  });

  it("never EXPLAINs DDL, multi-statement text or utility commands", async () => {
    const { query, sqls } = stub(seqScan("(u.a = $1)"), bigTable);
    await observePostgresWorkload(query, "app", [
      window("CREATE INDEX x ON users (a)"),
      window("SELECT 1; DROP TABLE users"),
      window("VACUUM users"),
    ]);
    expect(sqls).toEqual([]);
  });

  it("skips a fingerprint that fails to plan and keeps going", async () => {
    let n = 0;
    const query: PostgresQueryFn = async (sql) => {
      if (sql.startsWith("EXPLAIN") && n++ === 0) throw new Error("relation does not exist");
      if (sql.startsWith("EXPLAIN"))
        return { rows: [{ "QUERY PLAN": [{ Plan: seqScan("(u.a = $1)") }] }] };
      return { rows: [{ ...bigTable, known_columns: 1 }] };
    };
    const proposals = await observePostgresWorkload(query, "app", [
      window("SELECT a FROM gone WHERE a = $1", 200),
      window("SELECT a FROM users WHERE a = $1"),
    ]);
    expect(proposals.map((p) => p.columns)).toEqual([["a"]]);
  });
});
