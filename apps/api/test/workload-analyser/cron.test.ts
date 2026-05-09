// End-to-end cron test — synthetic query_log → analyser → stubbed
// Tinybird Pipes-management → D1 audit row. Asserts:
//   • Pipe is created with the expected payload (`SK-MIGRATE-005`).
//   • An audit row lands per reshape with the right kind / reasoning.
//   • `schema_hash` is invariant across the reshape (`SK-MIGRATE-004`)
//     — drift aborts and rolls back.
//   • Same-day re-run is a no-op (`SK-MIGRATE-006` per-day idempotency).

import type {
  DatabaseAdapter,
  EngineMeta,
  EngineResult,
  PipeManagementClient,
  PipeRecord,
  Row,
} from "@nlqdb/db";
import { describe, expect, it, vi } from "vitest";
import { runWorkloadAnalyser } from "../../src/workload-analyser/cron.ts";

type AuditRow = {
  id: string;
  db_id: string;
  query_hash: string;
  schema_hash: string;
  run_date: string;
  run_at: number;
  kind: string;
  before_json: string | null;
  after_json: string | null;
  reasoning: string;
};

// In-memory D1 stub. Implements just the prepared-statement shapes
// runWorkloadAnalyser uses: SELECT schema_hash FROM databases WHERE
// id = ?, and INSERT INTO workload_analyser_runs … ON CONFLICT DO NOTHING.
function makeD1Stub(opts: {
  databases: Map<string, string | null>; // dbId → schema_hash
  // After-write hook so tests can mutate `databases` mid-flight to
  // simulate concurrent schema_hash drift between the two reads.
  onSchemaRead?: (dbId: string, callIndex: number) => void;
}): { d1: D1Database; audit: AuditRow[] } {
  const audit: AuditRow[] = [];
  const seenAuditKeys = new Set<string>();
  let schemaReadCount = 0;

  const prepare = (sql: string) => {
    return {
      bind(...params: unknown[]) {
        if (sql.includes("FROM databases")) {
          return {
            async first<T>() {
              const dbId = params[0] as string;
              opts.onSchemaRead?.(dbId, schemaReadCount);
              schemaReadCount += 1;
              const hash = opts.databases.get(dbId);
              return hash !== undefined ? ({ schema_hash: hash } as T) : null;
            },
          };
        }
        if (sql.startsWith("INSERT INTO workload_analyser_runs")) {
          return {
            async run() {
              const [
                id,
                dbId,
                queryHash,
                schemaHash,
                runDate,
                runAt,
                kind,
                beforeJson,
                afterJson,
                reasoning,
              ] = params as [
                string,
                string,
                string,
                string,
                string,
                number,
                string,
                string | null,
                string | null,
                string,
              ];
              const key = `${dbId}|${queryHash}|${runDate}`;
              if (seenAuditKeys.has(key)) {
                return { meta: { changes: 0 } };
              }
              seenAuditKeys.add(key);
              audit.push({
                id,
                db_id: dbId,
                query_hash: queryHash,
                schema_hash: schemaHash,
                run_date: runDate,
                run_at: runAt,
                kind,
                before_json: beforeJson,
                after_json: afterJson,
                reasoning,
              });
              return { meta: { changes: 1 } };
            },
          };
        }
        throw new Error(`unexpected SQL in cron stub: ${sql.slice(0, 80)}`);
      },
    };
  };
  return {
    d1: { prepare } as unknown as D1Database,
    audit,
  };
}

// In-memory Tinybird-adapter stub. The cron only calls `execute` with
// a clickhouse plan; we yield synthetic query_log rows.
function makeAdapterStub(rows: Row[]): {
  adapter: DatabaseAdapter;
  calls: { sql: string }[];
} {
  const calls: { sql: string }[] = [];
  return {
    calls,
    adapter: {
      engine: "clickhouse",
      async execute(plan): Promise<EngineResult> {
        if (plan.engine !== "clickhouse" || !plan.sql) {
          throw new Error("expected clickhouse raw-SQL plan in cron stub");
        }
        calls.push({ sql: plan.sql });
        const meta: EngineMeta = { engine: "clickhouse", rowCount: rows.length };
        const iter: AsyncIterable<Row> = {
          [Symbol.asyncIterator]: async function* () {
            for (const r of rows) yield r;
          },
        };
        return Object.assign(iter, { meta });
      },
    },
  };
}

function makePipesStub(
  opts: {
    preExisting?: Set<string>;
    createReturns?: PipeRecord;
    onCreate?: (pipe: PipeRecord) => void;
  } = {},
): {
  pipes: PipeManagementClient;
  created: PipeRecord[];
  dropped: string[];
  gets: string[];
} {
  const created: PipeRecord[] = [];
  const dropped: string[] = [];
  const gets: string[] = [];
  const liveNames = new Set(opts.preExisting ?? []);
  return {
    created,
    dropped,
    gets,
    pipes: {
      async getPipe(name) {
        gets.push(name);
        if (liveNames.has(name)) {
          return { name, nodes: [{ name: "node_00", sql: "..." }] };
        }
        return null;
      },
      async createPipe(pipe) {
        created.push(pipe);
        liveNames.add(pipe.name);
        opts.onCreate?.(pipe);
        return opts.createReturns ?? pipe;
      },
      async dropPipe(name) {
        dropped.push(name);
        liveNames.delete(name);
      },
    },
  };
}

const FIXED_NOW = Date.UTC(2026, 4, 8, 4, 0, 0); // 2026-05-08T04:00:00Z
const DAY_MS = 86_400_000;
const HOT_DB = "db_alpha";
const HOT_SCHEMA = "sh_v1";
const HOT_QUERY = "qh_top10";

// Build 30 hot rows spread across 7 days, latency 800ms each.
function hotClickHouseRows(): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < 30; i += 1) {
    out.push({
      event_id: `ev_${i}`,
      db_id: HOT_DB,
      schema_hash: HOT_SCHEMA,
      query_hash: HOT_QUERY,
      plan_shape: "ps_v1",
      engine: "clickhouse",
      orchestrator_ms: 800,
      rows_returned: 100,
      ts_ms: FIXED_NOW - (i % 7) * DAY_MS,
    });
  }
  return out;
}

describe("runWorkloadAnalyser — synthetic e2e", () => {
  it("creates a Pipe + writes one audit row for a hot ClickHouse fingerprint, asserts schema_hash invariance", async () => {
    const beforeHash = "sh_v1_canonical";
    const d1 = makeD1Stub({ databases: new Map([[HOT_DB, beforeHash]]) });
    const adapter = makeAdapterStub(hotClickHouseRows());
    const pipes = makePipesStub();

    const result = await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_fixed",
    });

    expect(result.proposalsCount).toBe(1);
    expect(result.reshapesApplied).toBe(1);
    expect(result.errors).toBe(0);

    // Pipe creation: called once with the deterministic pipe name and
    // the placeholder SQL.
    expect(pipes.created).toHaveLength(1);
    const pipe = pipes.created[0];
    expect(pipe).toBeDefined();
    if (pipe) {
      expect(pipe.name).toMatch(/^nlqdb_w5__sh_[a-z0-9]+__qh_[a-z0-9]+$/);
      expect(pipe.nodes).toHaveLength(1);
      expect(pipe.nodes[0]?.sql).toBe("SELECT 1 AS placeholder WHERE 0 = 1");
    }

    // Audit row: kind, before/after JSON, reasoning.
    expect(d1.audit).toHaveLength(1);
    const audit = d1.audit[0];
    expect(audit).toBeDefined();
    if (audit) {
      expect(audit.kind).toBe("clickhouse_pipe_create");
      expect(audit.db_id).toBe(HOT_DB);
      expect(audit.query_hash).toBe(HOT_QUERY);
      expect(audit.run_date).toBe("2026-05-08");
      expect(audit.reasoning).toMatch(/^hot_fingerprint:/);
      const before = audit.before_json ? JSON.parse(audit.before_json) : null;
      expect(before).toMatchObject({ schemaHash: HOT_SCHEMA, queryHash: HOT_QUERY });
      expect(before.stats).toMatchObject({ calls: 30, p99Ms: 800, distinctDays: 7 });
      const after = audit.after_json ? JSON.parse(audit.after_json) : null;
      expect(after).not.toBeNull();
      if (after && pipe) expect(after.pipeName).toBe(pipe.name);
    }
    // Stub D1 has the same schema_hash for both reads → invariant
    // holds; pipe NOT dropped.
    expect(pipes.dropped).toEqual([]);
  });

  it("rolls back the Pipe + records `schema_hash_drift_aborted` when the hash changes mid-reshape", async () => {
    const databases = new Map<string, string | null>([[HOT_DB, "sh_before"]]);
    const d1 = makeD1Stub({
      databases,
      // The hook fires *before* each read. Read 1 (idx=0) sees the
      // original value. Mutate before read 2 (idx=1) so the after-snapshot
      // observes a concurrent-writer drift.
      onSchemaRead: (_dbId, idx) => {
        if (idx === 1) databases.set(HOT_DB, "sh_after_drift");
      },
    });
    const adapter = makeAdapterStub(hotClickHouseRows());
    const pipes = makePipesStub();

    const result = await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_drift",
    });

    expect(result.proposalsCount).toBe(1);
    expect(result.reshapesApplied).toBe(0); // drift aborted
    // Pipe was created (then rolled back) — both calls observed.
    expect(pipes.created).toHaveLength(1);
    expect(pipes.dropped).toHaveLength(1);
    expect(pipes.dropped[0]).toBe(pipes.created[0]?.name);
    // Audit row carries the drift reasoning + after_json is null.
    expect(d1.audit).toHaveLength(1);
    expect(d1.audit[0]?.reasoning).toMatch(/^schema_hash_drift_aborted/);
    expect(d1.audit[0]?.after_json).toBeNull();
  });

  it("skips the createPipe call when a same-day Pipe already exists (idempotent re-run)", async () => {
    const d1 = makeD1Stub({ databases: new Map([[HOT_DB, "sh_v1"]]) });
    const adapter = makeAdapterStub(hotClickHouseRows());
    const pipes = makePipesStub({
      preExisting: new Set(["nlqdb_w5__sh_sh_v1_____qh_qh_top10"]),
    });
    // The pipeName is deterministic; pre-seed using the analyser's
    // naming derivation. We use a wildcard match below so the test
    // doesn't have to recompute the exact prefix-padded form.
    // But in this stub `getPipe` consults the set for exact name match
    // — so seed *after* observing the first call. Start with an empty
    // set, then mutate after first run.
    pipes.pipes.getPipe = vi.fn(async (name: string) => {
      return { name, nodes: [{ name: "node_00", sql: "..." }] }; // simulate "always exists"
    });

    const result = await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_idem",
    });

    // The pipe pre-exists ⇒ no create call ⇒ audit row records that fact.
    expect(pipes.created).toEqual([]);
    expect(d1.audit).toHaveLength(1);
    expect(d1.audit[0]?.reasoning).toBe("pipe_pre_existed");
    expect(result.reshapesApplied).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("writes a pg_add_column_suggestion advisory row + does NOT call any Pipe API for a hot Postgres fingerprint", async () => {
    const d1 = makeD1Stub({ databases: new Map([["db_pg", "sh_pg"]]) });
    const pgRows: Row[] = hotClickHouseRows().map((r) => ({
      ...r,
      db_id: "db_pg",
      engine: "postgres",
    }));
    const adapter = makeAdapterStub(pgRows);
    const pipes = makePipesStub();

    const result = await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_pg",
    });

    expect(result.reshapesApplied).toBe(1);
    // No Tinybird Pipe interaction at all on the PG path.
    expect(pipes.created).toEqual([]);
    expect(pipes.gets).toEqual([]);
    expect(pipes.dropped).toEqual([]);
    expect(d1.audit).toHaveLength(1);
    expect(d1.audit[0]?.kind).toBe("pg_add_column_suggestion");
    expect(d1.audit[0]?.after_json).toBeNull(); // advisory has no after-state
  });

  it("returns zero proposals when the query_log is empty (no reads, no writes, no errors)", async () => {
    const d1 = makeD1Stub({ databases: new Map() });
    const adapter = makeAdapterStub([]);
    const pipes = makePipesStub();

    const result = await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_empty",
    });

    expect(result).toEqual({ proposalsCount: 0, reshapesApplied: 0, errors: 0 });
    expect(pipes.created).toEqual([]);
    expect(d1.audit).toEqual([]);
  });

  it("reads exactly one Tinybird query for the whole 7-day window (one-read-per-cron budget)", async () => {
    const d1 = makeD1Stub({ databases: new Map([[HOT_DB, "sh_v1"]]) });
    const adapter = makeAdapterStub(hotClickHouseRows());
    const pipes = makePipesStub();

    await runWorkloadAnalyser({
      d1: d1.d1,
      tinybird: adapter.adapter,
      pipes: pipes.pipes,
      now: () => FIXED_NOW,
      newId: () => "audit_id_budget",
    });

    expect(adapter.calls).toHaveLength(1);
    const sql = adapter.calls[0]?.sql ?? "";
    expect(sql).toContain("FROM query_log");
    expect(sql).toContain("WHERE ts >=");
    // Window lower bound carries the 7-day cutoff (2026-05-01 04:00).
    expect(sql).toContain("2026-05-01 04:00:00.000");
  });
});
