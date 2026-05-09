// Daily Cron handler — reads the last 7 days of `query_log`, runs the
// pure analyser, and dispatches reshapes through the Pipes-management
// API. Per `GLOBAL-021` all Tinybird HTTP flows through `@nlqdb/db`'s
// typed surface (`adapter.execute` for the read; `createPipe` /
// `dropPipe` / `getPipe` for the writes). The token never appears in
// this directory — `apps/api/src/index.ts` constructs the Tinybird
// adapter and the Pipes client and injects them as deps.
//
// Schema-hash invariant (`SK-MIGRATE-004`): the cron snapshots the
// DB's `schema_hash` before the reshape and re-reads it after. Any
// drift aborts the reshape, drops the partial Pipe, and surfaces in
// the audit row's `reasoning`.
//
// Idempotency (`SK-MIGRATE-006`): the audit-row UNIQUE INDEX on
// `(db_id, query_hash, run_date)` makes a same-day re-run a no-op.
// Tinybird's `getPipe → 404` short-circuit is a second layer — a Pipe
// already created today's not re-POSTed.

import type { DatabaseAdapter, EnginePlan, PipeManagementClient } from "@nlqdb/db";
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { analyseQueryLog, type QueryLogRow, type ReshapeProposal } from "./analyse.ts";
import { POLICY } from "./policy.ts";

export type RunWorkloadAnalyserDeps = {
  d1: D1Database;
  // Pre-constructed Tinybird read adapter (allowlist scoped to
  // `query_log`). Owner: `packages/db/clickhouse-tinybird` per GLOBAL-021.
  tinybird: DatabaseAdapter;
  // Pre-constructed Pipes management client. Owner: same.
  pipes: PipeManagementClient;
  // Time + UUID injection for testability.
  now: () => number;
  newId: () => string;
};

export type RunWorkloadAnalyserResult = {
  proposalsCount: number;
  reshapesApplied: number;
  errors: number;
};

const PLACEHOLDER_PIPE_SQL = "SELECT 1 AS placeholder WHERE 0 = 1";

export async function runWorkloadAnalyser(
  deps: RunWorkloadAnalyserDeps,
): Promise<RunWorkloadAnalyserResult> {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.workload_analyser.run", async (span) => {
    const startedAt = deps.now();
    let proposalsCount = 0;
    let reshapesApplied = 0;
    let errors = 0;
    try {
      const rows = await readQueryLogWindow(deps.tinybird, POLICY.WINDOW_DAYS, deps.now());
      span.setAttribute("nlqdb.workload_analyser.query_log_rows", rows.length);
      const proposals = analyseQueryLog(rows, POLICY);
      proposalsCount = proposals.length;
      span.setAttribute("nlqdb.workload_analyser.proposals", proposalsCount);

      for (const proposal of proposals) {
        try {
          const applied = await dispatchReshape(deps, proposal);
          if (applied) reshapesApplied += 1;
        } catch (err) {
          errors += 1;
          // Per-proposal failure does not abort the cron — `SK-MIGRATE-006`.
          // The error is surfaced on the per-reshape child span; the run
          // span just counts.
          span.setAttribute(
            "nlqdb.workload_analyser.last_error",
            err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
          );
        }
      }
      span.setAttribute("nlqdb.workload_analyser.reshapes_applied", reshapesApplied);
      span.setAttribute("nlqdb.workload_analyser.errors", errors);
      return { proposalsCount, reshapesApplied, errors };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.setAttribute("nlqdb.workload_analyser.elapsed_ms", deps.now() - startedAt);
      span.end();
    }
  });
}

// One Tinybird read per cron run for the whole 7-day window across all
// DBs in the workspace. Stays inside `SK-MIGRATE-001`'s "one read per
// DB-day max" budget by a wide margin (one read total).
async function readQueryLogWindow(
  adapter: DatabaseAdapter,
  windowDays: number,
  nowMs: number,
): Promise<QueryLogRow[]> {
  const sinceMs = nowMs - windowDays * 86_400_000;
  const sinceIso = toClickHouseDateTime(sinceMs);
  const sql = [
    "SELECT event_id, db_id, schema_hash, query_hash, plan_shape, engine,",
    "       toUnixTimestamp64Milli(ts) AS ts_ms,",
    "       orchestrator_ms, rows_returned",
    "FROM query_log",
    `WHERE ts >= '${sinceIso}'`,
    "ORDER BY ts ASC",
    "LIMIT 100000",
  ].join("\n");

  const plan: EnginePlan = { engine: "clickhouse", sql };
  const result = await adapter.execute(plan);
  const out: QueryLogRow[] = [];
  for await (const row of result) {
    out.push({
      eventId: String(row["event_id"] ?? ""),
      dbId: String(row["db_id"] ?? ""),
      schemaHash: String(row["schema_hash"] ?? ""),
      queryHash: String(row["query_hash"] ?? ""),
      planShape: String(row["plan_shape"] ?? ""),
      engine: row["engine"] === "clickhouse" ? "clickhouse" : "postgres",
      orchestratorMs: Number(row["orchestrator_ms"] ?? 0),
      rowsReturned: Number(row["rows_returned"] ?? 0),
      ts: Number(row["ts_ms"] ?? 0),
    });
  }
  return out;
}

// Returns true when the audit row was written + (for clickhouse_pipe_create)
// the Pipe was actually created. Returns false when the proposal collided
// with an existing same-day audit row (idempotent no-op).
async function dispatchReshape(
  deps: RunWorkloadAnalyserDeps,
  proposal: ReshapeProposal,
): Promise<boolean> {
  const tracer = trace.getTracer("@nlqdb/api");
  return tracer.startActiveSpan("nlqdb.workload_analyser.reshape", async (span) => {
    span.setAttribute("nlqdb.workload_analyser.kind", proposal.kind);
    span.setAttribute("nlqdb.workload_analyser.db_id", proposal.dbId);
    try {
      if (proposal.kind === "clickhouse_pipe_create") {
        return await dispatchClickhousePipeCreate(deps, proposal, span);
      }
      return await dispatchPgAdvisory(deps, proposal, span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}

async function dispatchClickhousePipeCreate(
  deps: RunWorkloadAnalyserDeps,
  proposal: Extract<ReshapeProposal, { kind: "clickhouse_pipe_create" }>,
  span: Span,
): Promise<boolean> {
  const before = await readSchemaHash(deps.d1, proposal.dbId);
  // Same-day idempotency: if Tinybird already has the Pipe, skip the
  // POST and short-circuit to the audit row write (which is itself
  // idempotent via UNIQUE INDEX).
  const existing = await deps.pipes.getPipe(proposal.pipeName);
  if (existing) {
    span.setAttribute("nlqdb.workload_analyser.pipe_pre_existed", true);
    return await writeAudit(deps, {
      proposal,
      reasoning: "pipe_pre_existed",
      afterPipeName: proposal.pipeName,
    });
  }

  try {
    await deps.pipes.createPipe({
      name: proposal.pipeName,
      nodes: [{ name: "node_00", sql: PLACEHOLDER_PIPE_SQL }],
    });
  } catch (err) {
    // Surface the wire failure on the audit row — the analyser moves
    // on; tomorrow's cron retries (`SK-MIGRATE-006`).
    await writeAudit(deps, {
      proposal,
      reasoning: `pipe_create_failed: ${truncateMessage(err)}`,
      afterPipeName: null,
    });
    throw err;
  }

  const after = await readSchemaHash(deps.d1, proposal.dbId);
  if (before !== after) {
    // SK-MIGRATE-004 invariant violated — drop the Pipe (best effort)
    // and record the drift. This is a reviewer-blocking failure mode;
    // production drift here means a concurrent writer changed the
    // logical hash, which contradicts GLOBAL-004's monotonic-widening
    // guarantee under read-only cron.
    try {
      await deps.pipes.dropPipe(proposal.pipeName);
    } catch {
      // Best effort — the reasoning carries the dual failure.
    }
    await writeAudit(deps, {
      proposal,
      reasoning: `schema_hash_drift_aborted: before=${before} after=${after}`,
      afterPipeName: null,
    });
    return false;
  }

  span.setAttribute("nlqdb.workload_analyser.pipe_name", proposal.pipeName);
  return await writeAudit(deps, {
    proposal,
    reasoning: reasoningFromStats(proposal.stats),
    afterPipeName: proposal.pipeName,
  });
}

async function dispatchPgAdvisory(
  deps: RunWorkloadAnalyserDeps,
  proposal: Extract<ReshapeProposal, { kind: "pg_add_column_suggestion" }>,
  _span: Span,
): Promise<boolean> {
  return await writeAudit(deps, {
    proposal,
    reasoning: reasoningFromStats(proposal.stats),
    afterPipeName: null,
  });
}

type AuditWrite = {
  proposal: ReshapeProposal;
  reasoning: string;
  afterPipeName: string | null;
};

async function writeAudit(deps: RunWorkloadAnalyserDeps, input: AuditWrite): Promise<boolean> {
  const { proposal, reasoning, afterPipeName } = input;
  const runDate = utcDay(deps.now());
  const beforeJson = JSON.stringify({
    schemaHash: proposal.schemaHash,
    queryHash: proposal.queryHash,
    stats: proposal.stats,
  });
  const afterJson =
    proposal.kind === "clickhouse_pipe_create" && afterPipeName
      ? JSON.stringify({ pipeName: afterPipeName })
      : null;
  const result = await deps.d1
    .prepare(
      `INSERT INTO workload_analyser_runs
         (id, db_id, query_hash, schema_hash, run_date, run_at, kind, before_json, after_json, reasoning)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (db_id, query_hash, run_date) DO NOTHING`,
    )
    .bind(
      deps.newId(),
      proposal.dbId,
      proposal.queryHash,
      proposal.schemaHash,
      runDate,
      Math.floor(deps.now() / 1000),
      proposal.kind,
      beforeJson,
      afterJson,
      reasoning,
    )
    .run();
  // D1's run() returns `{ meta: { changes } }`. A 0-change result means
  // the same-day audit row already exists (UNIQUE INDEX collision) —
  // idempotent re-run, return false.
  return (result.meta?.changes ?? 0) > 0;
}

async function readSchemaHash(d1: D1Database, dbId: string): Promise<string | null> {
  const row = await d1
    .prepare("SELECT schema_hash FROM databases WHERE id = ?")
    .bind(dbId)
    .first<{ schema_hash: string | null }>();
  return row?.schema_hash ?? null;
}

function reasoningFromStats(stats: { calls: number; p99Ms: number; distinctDays: number }): string {
  return `hot_fingerprint: calls=${stats.calls} p99=${stats.p99Ms}ms days=${stats.distinctDays}`;
}

function truncateMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200);
}

function utcDay(unixMs: number): string {
  const d = new Date(unixMs);
  const pad2 = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function toClickHouseDateTime(unixMs: number): string {
  const d = new Date(unixMs);
  const pad2 = (n: number): string => n.toString().padStart(2, "0");
  const pad3 = (n: number): string => n.toString().padStart(3, "0");
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
    d.getUTCHours(),
  )}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${pad3(d.getUTCMilliseconds())}`;
}
