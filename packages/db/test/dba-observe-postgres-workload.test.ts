import { createTestTelemetry } from "@nlqdb/otel/test";
import { describe, expect, it } from "vitest";
import {
  type FingerprintWindow,
  newTier1Funnel,
  observePostgresWorkload,
  type StatementSnapshot,
  statementWindow,
} from "../src/index.ts";
import type { PostgresQueryFn } from "../src/postgres.ts";

// Counters for `calls` runs of `times` ms each, as pg_stat_statements keeps them.
const counters = (query: string, times: number[]) => {
  const calls = times.length;
  const totalMs = times.reduce((s, t) => s + t, 0);
  const sumSquaresMs = times.reduce((s, t) => s + t * t, 0);
  return { query, calls, totalMs, sumSquaresMs, rows: calls * 10 };
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
    // Its rows are the window's too: 10 per call.
    expect(q1?.rows).toBe(20);
    expect(rest).toEqual([]);
  });

  it("counts from zero after a stats reset", () => {
    const before: StatementSnapshot = new Map([["1", counters("q", [1, 1, 1])]]);
    const after: StatementSnapshot = new Map([["1", counters("q", [4])]]);
    expect(statementWindow(before, after)[0]).toMatchObject({ calls: 1, totalMs: 4 });
  });
});

// 50 calls returning `rows` in all: by default one row each, 0.01 % of `bigTable`.
const window = (query: string, totalMs = 100, rows = 50): FingerprintWindow => ({
  fingerprint: "42",
  query,
  calls: 50,
  totalMs,
  meanMs: totalMs / 50,
  p95EstimateMs: totalMs / 25,
  rows,
});

// The attached schema's relations, as the candidate filter reads them.
const relations = { rows: [{ relname: "users" }, { relname: "Gone" }] };

// A stub that answers EXPLAIN with `plan` (the nth of an array on the nth
// EXPLAIN) and the table check with `table`.
function stub(plan: unknown, table: Record<string, number | boolean>) {
  const sqls: string[] = [];
  let explained = 0;
  const query: PostgresQueryFn = async (sql) => {
    if (sql.includes("relkind IN")) return relations;
    sqls.push(sql);
    if (sql.startsWith("EXPLAIN")) {
      const p = Array.isArray(plan) ? plan[explained++] : plan;
      return { rows: [{ "QUERY PLAN": JSON.stringify([{ Plan: p }]) }] };
    }
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

  it("reads a varchar column's `::text` relabel as an equality the table check confirms", async () => {
    const { query, sqls } = stub(seqScan(`((u.email)::text = $1)`), {
      ...bigTable,
      known_columns: 1,
    });
    const [p] = await observePostgresWorkload(query, "app", [window("SELECT 1 FROM users")]);
    expect(p?.columns).toEqual(["email"]);
    expect(sqls).toHaveLength(2);
  });

  it.each([
    ["an `IN` list", "(u.a = ANY (ARRAY[$1, $2, $3]))", ["a"], []],
    ["PostgREST's `in` filter", "((u.a = ANY ($1)) AND (u.b = $2))", ["a", "b"], []],
    ["a varchar `IN` list", "((u.a)::text = ANY ((ARRAY[$1, $2])::text[]))", ["a"], ["a"]],
    ["a constant array", "(u.a = ANY ('{1,2}'::bigint[]))", ["a"], []],
    ["a mixed list", "(u.a = ANY (ARRAY[$1, ($2)::bigint, 'x)]'::text, -3]))", ["a"], []],
  ])("reads %s as an equality a btree serves", async (_, filter, columns, textCast) => {
    const { query } = stub(seqScan(filter), { ...bigTable, known_columns: columns.length });
    const params: unknown[][] = [];
    const spy: PostgresQueryFn = (sql, p) => {
      params.push(p);
      return query(sql, p);
    };
    const [p] = await observePostgresWorkload(spy, "app", [window("SELECT 1 FROM users")]);
    expect(p?.columns).toEqual(columns);
    // The table check confirms a `::text`-compared column is varchar.
    expect(params.at(-1)?.[3]).toBe(JSON.stringify(textCast));
  });

  it.each([
    ["an equality ANDed with a range", "((u.a = $1) AND (u.b > $2))", ["a", "b"], "b", []],
    ["a `BETWEEN`", "((u.at >= $1) AND (u.at <= $2))", ["at"], "at", []],
    ["a range on the clock", "(u.at > (now() - '7 days'::interval))", ["at"], "at", []],
    [
      "a range on today",
      "((u.org = $1) AND (u.day >= (CURRENT_DATE - 7)))",
      ["org", "day"],
      "day",
      [],
    ],
    [
      "a varchar range",
      "((u.a = ANY ($1)) AND ((u.code)::text < 'm'::text))",
      ["a", "code"],
      "code",
      ["code"],
    ],
    ["a range on an equality column", "((u.a = $1) AND (u.a > $2))", ["a"], null, []],
  ])(
    "reads %s as one index range, the range column last",
    async (_, filter, columns, range, textCast) => {
      const { query } = stub(seqScan(filter), { ...bigTable, known_columns: columns.length });
      const params: unknown[][] = [];
      const spy: PostgresQueryFn = (sql, p) => {
        params.push(p);
        return query(sql, p);
      };
      const funnel = newTier1Funnel();
      const [p] = await observePostgresWorkload(
        spy,
        "app",
        [window("SELECT 1 FROM users")],
        funnel,
      );
      expect(p?.columns).toEqual(columns);
      expect(p?.ddl).toContain(`(${columns.map((c) => `"${c}"`).join(", ")})`);
      // The table check's coverage rule wants the range column as the nth key.
      expect(params.at(-1)?.slice(3)).toEqual([JSON.stringify(textCast), range]);
      expect(funnel).toMatchObject({ readScans: 1, rangeScans: range ? 1 : 0, unreadShapes: [] });
    },
  );

  // One fingerprint per scan: a range's rows are measured per fingerprint.
  const each = (plans: unknown[]) => plans.map((_, i) => window(`SELECT ${i} FROM users`));

  it("proposes one index for the scans it serves, never the same DDL twice", async () => {
    const plans = [
      seqScan("((u.a = $1) AND (u.b > $2))"),
      seqScan("((u.b = $1) AND (u.a = $2))"),
      // (a, b) can't serve a range on a: it needs its own (b, a).
      seqScan("((u.b = $1) AND (u.a < $2))"),
    ];
    const proposals = await observePostgresWorkload(
      stub(plans, bigTable).query,
      "app",
      each(plans),
    );
    expect(proposals.map((p) => p.columns)).toEqual([
      ["a", "b"],
      ["b", "a"],
    ]);
  });

  it("skips a scan an earlier proposal's leading keys serve, as the table check would", async () => {
    const plans = [
      seqScan("((u.a = $1) AND (u.b = $2) AND (u.c > $3))"),
      seqScan("((u.b = $1) AND (u.a = $2))"),
      seqScan("((u.a = $1) AND (u.b > $2))"),
      // (a, b, c) can't serve a range on a: it needs its own (b, a).
      seqScan("((u.b = $1) AND (u.a > $2))"),
    ];
    const { query } = stub(plans, bigTable);
    const sized: PostgresQueryFn = async (sql, p) => {
      const res = await query(sql, p);
      if (!sql.includes("row_estimate")) return res;
      return { rows: [{ ...bigTable, known_columns: JSON.parse(String(p[2])).length }] };
    };
    const proposals = await observePostgresWorkload(sized, "app", each(plans));
    expect(proposals.map((p) => p.columns)).toEqual([
      ["a", "b", "c"],
      ["b", "a"],
    ]);
  });

  it("scales a parallel scan's per-process rows back before judging selectivity", async () => {
    // 200 rows per process x (2 workers + 0.4 leader) = 480 of 10 000: 4.8 % ≤ 5 %.
    const gather = (planRows: number) => ({
      "Node Type": "Gather",
      "Workers Planned": 2,
      Plans: [{ ...seqScan("(u.a = $1)", planRows), "Parallel Aware": true }],
    });
    const table = { ...bigTable, known_columns: 1 };
    expect(
      await observePostgresWorkload(stub(gather(200), table).query, "app", [
        window("SELECT 1 FROM users"),
      ]),
    ).toHaveLength(1);
    // 250 x 2.4 = 600: 6 % — unselective, though 250 alone would read 2.5 %.
    expect(
      await observePostgresWorkload(stub(gather(250), table).query, "app", [
        window("SELECT 1 FROM users"),
      ]),
    ).toEqual([]);
  });

  it.each([
    ["an OR filter", seqScan("((u.a = $1) OR (u.b = $2))"), bigTable],
    ["ranges on two columns", seqScan("((u.a > $1) AND (u.b < $2))"), bigTable],
    ["a range bound read from the row", seqScan("(u.a > u.b)"), bigTable],
    ["a range ORed with an equality", seqScan("((u.a > $1) OR (u.b = $2))"), bigTable],
    ["a `<> ALL` (a `NOT IN` list)", seqScan("(u.a <> ALL (ARRAY[$1, $2]))"), bigTable],
    ["an `= ANY` over the row's own columns", seqScan("(u.a = ANY (ARRAY[u.b, u.c]))"), bigTable],
    ["an `= ANY` ORed with an equality", seqScan("((u.a = ANY ($1)) OR (u.b = $2))"), bigTable],
    ["an unselective filter", seqScan("(u.a = $1)", 2_000), bigTable],
    ["an already covered column set", seqScan("(u.a = $1)"), { ...bigTable, covered: 1 }],
    ["another schema", { ...seqScan("(u.a = $1)"), Schema: "other" }, bigTable],
  ])("proposes nothing for %s", async (_, plan, table) => {
    const { query } = stub(plan, { ...table, known_columns: 1 });
    expect(await observePostgresWorkload(query, "app", [window("SELECT 1 FROM users")])).toEqual(
      [],
    );
  });

  it("judges a parameter-bound range on its measured rows per call, never the generic plan's guess", async () => {
    // Both plans guess 0.5 % (50 of 10 000) for the `BETWEEN`, whatever range the app passes.
    const between = seqScan("((u.at >= $1) AND (u.at <= $2))", 50);
    const table = { ...bigTable, known_columns: 1 };
    const narrow = newTier1Funnel();
    const [p] = await observePostgresWorkload(
      stub({ "Node Type": "Sort", Plans: [between] }, table).query,
      "app",
      [window("SELECT 1 FROM users", 100, 50 * 120)],
      narrow,
    );
    // 120 rows per call: 1.2 % of the table.
    expect(p?.columns).toEqual(["at"]);
    const wide = newTier1Funnel();
    expect(
      await observePostgresWorkload(
        stub(between, table).query,
        "app",
        [window("SELECT 1 FROM users", 100, 50 * 9_000)],
        wide,
      ),
    ).toEqual([]);
    expect(wide).toMatchObject({ unselective: 1, unselectivePct: [90] });
    // A one-sided range guesses a third: measured narrow (the last day), it is proposed.
    expect(
      await observePostgresWorkload(stub(seqScan("(u.at > $1)", 3_333), table).query, "app", [
        window("SELECT 1 FROM users", 100, 50 * 40),
      ]),
    ).toHaveLength(1);
  });

  it.each([
    ["an aggregate", "Aggregate"],
    ["a limit", "Limit"],
  ])(
    "leaves a parameter-bound range under %s unjudged: its rows aren't the statement's",
    async (_, node) => {
      const funnel = newTier1Funnel();
      const plan = { "Node Type": node, Plans: [seqScan("((u.at >= $1) AND (u.at <= $2))", 50)] };
      expect(
        await observePostgresWorkload(
          stub(plan, { ...bigTable, known_columns: 1 }).query,
          "app",
          [window("SELECT 1 FROM users")],
          funnel,
        ),
      ).toEqual([]);
      expect(funnel).toMatchObject({ unjudgedRanges: 1, unselective: 0 });
    },
  );

  it("leaves each side of a join unjudged, and keeps the plan's estimate for a clock bound", async () => {
    const funnel = newTier1Funnel();
    const plan = {
      "Node Type": "Hash Join",
      Plans: [
        seqScan("(u.at > $1)", 1),
        { "Node Type": "Hash", Plans: [seqScan("(u.day >= (CURRENT_DATE - 7))", 1)] },
      ],
    };
    const proposals = await observePostgresWorkload(
      stub(plan, { ...bigTable, known_columns: 1 }).query,
      "app",
      [window("SELECT 1 FROM users", 100, 50 * 10_000)],
      funnel,
    );
    // The clock bound is planned from the column's histogram, not the measured rows.
    expect(proposals.map((p) => p.columns)).toEqual([["day"]]);
    expect(funnel).toMatchObject({ unjudgedRanges: 1 });
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

  it("plans only fingerprints naming a relation of the attached schema, so the host's own heavy statements don't spend the budget", async () => {
    const { query, sqls } = stub(seqScan("(u.a = $1)"), { ...bigTable, known_columns: 1 });
    const hostOwn = Array.from({ length: 25 }, (_, i) =>
      window(`SELECT * FROM realtime.subscription WHERE id = $${i + 1}`, 1_000 - i),
    );
    const funnel = newTier1Funnel();
    const proposals = await observePostgresWorkload(
      query,
      "app",
      [
        ...hostOwn,
        window("SELECT * FROM gone WHERE a = $1"), // unquoted folds to `gone`, not `Gone`
        window("SELECT * FROM USERS u WHERE a = $1", 1),
      ],
      funnel,
    );
    expect(funnel.candidates).toBe(1);
    expect(sqls.filter((s) => s.startsWith("EXPLAIN"))).toEqual([
      "EXPLAIN (GENERIC_PLAN, VERBOSE, FORMAT JSON) SELECT * FROM USERS u WHERE a = $1",
    ]);
    expect(proposals).toHaveLength(1);
  });

  it("judges a partition's lookup like a table's, and holds a selective one for the parent's index", async () => {
    const partition = { ...bigTable, known_columns: 1, is_partition: true };
    const selective = newTier1Funnel();
    expect(
      await observePostgresWorkload(
        stub(seqScan("(u.a = $1)"), partition).query,
        "app",
        [window("SELECT 1 FROM users")],
        selective,
      ),
    ).toEqual([]);
    expect(selective).toMatchObject({ partitions: 1, unselective: 0 });

    const unselective = newTier1Funnel();
    await observePostgresWorkload(
      stub(seqScan("(u.a = $1)", 3_000), partition).query,
      "app",
      [window("SELECT 1 FROM users")],
      unselective,
    );
    expect(unselective).toMatchObject({
      partitions: 0,
      unselective: 1,
      unselectivePct: [30],
      unselectiveRows: [10_000],
    });
  });

  it("counts the shape of each filtered scan it doesn't read, never the filter", async () => {
    const funnel = newTier1Funnel();
    const plan = {
      "Node Type": "Append",
      Plans: [
        seqScan("((u.a = $1) OR (u.b = $2))"),
        seqScan("((u.a >= $1) AND (u.b <= $2))"),
        seqScan("((u.a)::text ~~ $1)"),
        seqScan("(u.a <> $1)"),
        seqScan("(u.a = $1)"),
        { ...seqScan("(u.a > $1)"), Schema: "other" },
      ],
    };
    await observePostgresWorkload(
      stub(plan, { ...bigTable, known_columns: 1 }).query,
      "app",
      [window("SELECT 1 FROM users")],
      funnel,
    );
    expect(funnel).toMatchObject({
      filteredScans: 5,
      readScans: 1,
      unreadShapes: ["or", "range", "pattern", "other"],
    });
  });

  it("keeps a plan over hundreds of partitions to a bounded reason list, the count exact", async () => {
    const funnel = newTier1Funnel();
    const plan = {
      "Node Type": "Append",
      Plans: Array.from({ length: 365 }, () => seqScan("((u.a = $1) OR (u.b = $2))")),
    };
    await observePostgresWorkload(
      stub(plan, bigTable).query,
      "app",
      [window("SELECT 1 FROM users")],
      funnel,
    );
    expect(funnel.filteredScans).toBe(365);
    expect(funnel.unreadShapes).toHaveLength(50);
  });

  it("skips a fingerprint that fails to plan and keeps going", async () => {
    let n = 0;
    const query: PostgresQueryFn = async (sql) => {
      if (sql.includes("relkind IN")) return relations;
      if (sql.startsWith("EXPLAIN") && n++ === 0)
        throw Object.assign(new Error("relation does not exist"), {
          severity: "ERROR",
          code: "42P01",
        });
      if (sql.startsWith("EXPLAIN"))
        return { rows: [{ "QUERY PLAN": [{ Plan: seqScan("(u.a = $1)") }] }] };
      return { rows: [{ ...bigTable, known_columns: 1 }] };
    };
    const funnel = newTier1Funnel();
    const proposals = await observePostgresWorkload(
      query,
      "app",
      [
        window('SELECT a FROM "Gone" WHERE a = $1', 200),
        window("SELECT a FROM users WHERE a = $1"),
      ],
      funnel,
    );
    expect(proposals.map((p) => p.columns)).toEqual([["a"]]);
    expect(funnel).toMatchObject({
      planned: 1,
      unplanned: 1,
      unplannedCodes: ["42P01"],
      filteredScans: 1,
      readScans: 1,
    });
  });

  it("counts a scan on a non-plain table (a matview, or gone) apart from a covered one, on the span", async () => {
    const telemetry = createTestTelemetry();
    const query: PostgresQueryFn = async (sql) => {
      if (sql.includes("relkind IN")) return relations;
      if (sql.startsWith("EXPLAIN"))
        return { rows: [{ "QUERY PLAN": [{ Plan: seqScan("(u.a = $1)") }] }] };
      return { rows: [] };
    };
    try {
      expect(
        await observePostgresWorkload(query, "app", [window("SELECT a FROM users WHERE a = $1")]),
      ).toEqual([]);
      const span = telemetry.spanExporter
        .getFinishedSpans()
        .find((s) => s.attributes["db.operation.name"] === "observe_workload");
      expect(span?.attributes).toMatchObject({
        "nlqdb.dba.candidates": 1,
        "nlqdb.dba.unplanned": 0,
        "nlqdb.dba.read_scans": 1,
        "nlqdb.dba.not_table": 1,
        "nlqdb.dba.covered": 0,
      });
    } finally {
      telemetry.reset();
    }
  });

  it("throws on a failure the server didn't answer, rather than report nothing to change", async () => {
    const query: PostgresQueryFn = async () => {
      throw Object.assign(new Error("write CONNECTION_CLOSED"), { code: "CONNECTION_CLOSED" });
    };
    await expect(
      observePostgresWorkload(query, "app", [window("SELECT a FROM users WHERE a = $1")]),
    ).rejects.toThrow(/CONNECTION_CLOSED/);
  });
});
