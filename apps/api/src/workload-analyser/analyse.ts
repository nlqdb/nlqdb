// Pure analyser: `(rows, policy) → ReshapeProposal[]`. No I/O, no
// `Date.now()`, no randomness. Tests pin behaviour against fixed-frame
// fixtures (`SK-MIGRATE-002`).
//
// Input is the deduplicated `query_log` row stream for the analyser's
// 7-day window. Output is one `ReshapeProposal` per `(db_id,
// schema_hash, query_hash)` group that clears all three thresholds:
//   • call count    ≥ MIN_CALLS      (post-`event_id` dedup)
//   • p99 (ms)      ≥ MIN_P99_MS     (nearest-rank on `orchestrator_ms`)
//   • distinct days ≥ MIN_DISTINCT_DAYS (UTC `YYYY-MM-DD` from `ts`)

import type { Policy } from "./policy.ts";

export type Engine = "postgres" | "clickhouse";

export type QueryLogRow = {
  eventId: string;
  dbId: string;
  schemaHash: string;
  queryHash: string;
  planShape: string;
  engine: Engine;
  orchestratorMs: number;
  rowsReturned: number;
  ts: number; // Unix ms
};

export type ProposalStats = {
  calls: number;
  p99Ms: number;
  distinctDays: number;
};

export type ReshapeProposal =
  | {
      kind: "clickhouse_pipe_create";
      dbId: string;
      schemaHash: string;
      queryHash: string;
      pipeName: string;
      stats: ProposalStats;
    }
  | {
      kind: "pg_add_column_suggestion";
      dbId: string;
      schemaHash: string;
      queryHash: string;
      stats: ProposalStats;
    };

export function analyseQueryLog(rows: readonly QueryLogRow[], policy: Policy): ReshapeProposal[] {
  if (rows.length === 0) return [];

  const deduped = dedupeByEventId(rows);
  const groups = groupByFingerprint(deduped);

  const proposals: ReshapeProposal[] = [];
  for (const group of groups) {
    const stats = computeStats(group.rows);
    if (
      stats.calls < policy.MIN_CALLS ||
      stats.p99Ms < policy.MIN_P99_MS ||
      stats.distinctDays < policy.MIN_DISTINCT_DAYS
    ) {
      continue;
    }
    if (group.engine === "clickhouse") {
      proposals.push({
        kind: "clickhouse_pipe_create",
        dbId: group.dbId,
        schemaHash: group.schemaHash,
        queryHash: group.queryHash,
        pipeName: pipeNameFor(group.schemaHash, group.queryHash),
        stats,
      });
    } else {
      proposals.push({
        kind: "pg_add_column_suggestion",
        dbId: group.dbId,
        schemaHash: group.schemaHash,
        queryHash: group.queryHash,
        stats,
      });
    }
  }

  return proposals;
}

// Pipe naming convention: prefix flags analyser-owned Pipes for cleanup
// and encodes the (schema_hash, query_hash) fingerprint. Truncated hex
// keeps the name within Tinybird's identifier length limits while
// preserving collision resistance for the address space we'll see in
// Phase 1 (collision in the first 10 hex chars of two SHA-256 hashes is
// ~1e-12 per collision-day at our scale).
export function pipeNameFor(schemaHash: string, queryHash: string): string {
  const sh = safeIdent(schemaHash).slice(0, 10).padEnd(10, "0");
  const qh = safeIdent(queryHash).slice(0, 10).padEnd(10, "0");
  return `nlqdb_w5__sh_${sh}__qh_${qh}`;
}

function safeIdent(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type FingerprintGroup = {
  dbId: string;
  schemaHash: string;
  queryHash: string;
  engine: Engine;
  rows: QueryLogRow[];
};

function dedupeByEventId(rows: readonly QueryLogRow[]): QueryLogRow[] {
  const seen = new Set<string>();
  const out: QueryLogRow[] = [];
  for (const row of rows) {
    if (seen.has(row.eventId)) continue;
    seen.add(row.eventId);
    out.push(row);
  }
  return out;
}

function groupByFingerprint(rows: readonly QueryLogRow[]): FingerprintGroup[] {
  const map = new Map<string, FingerprintGroup>();
  for (const row of rows) {
    const key = `${row.dbId}|${row.schemaHash}|${row.queryHash}`;
    let group = map.get(key);
    if (!group) {
      group = {
        dbId: row.dbId,
        schemaHash: row.schemaHash,
        queryHash: row.queryHash,
        engine: row.engine,
        rows: [],
      };
      map.set(key, group);
    }
    group.rows.push(row);
  }
  return [...map.values()];
}

function computeStats(rows: QueryLogRow[]): ProposalStats {
  const latencies = rows.map((r) => r.orchestratorMs).sort((a, b) => a - b);
  const days = new Set<string>();
  for (const r of rows) days.add(utcDay(r.ts));
  return {
    calls: rows.length,
    p99Ms: percentileNearestRank(latencies, 99),
    distinctDays: days.size,
  };
}

// Nearest-rank percentile. For sorted ascending `xs`, the p99 is the
// element at rank `ceil(0.99 * n) − 1`, clamped to [0, n−1]. Empty input
// returns 0 (only reachable when no rows survive dedup; the calls gate
// would already have rejected the group).
function percentileNearestRank(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.max(
    0,
    Math.min(sortedAsc.length - 1, Math.ceil((pct / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx] ?? 0;
}

function utcDay(unixMs: number): string {
  const d = new Date(unixMs);
  const pad2 = (n: number): string => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
