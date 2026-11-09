// The scheduled Tier 1 observer (`GLOBAL-043` item 7): the `dba_observe` job
// reads each attached DB's workload for the window since its last observe and
// records the window's `create_index` proposals in the ledger — `proposed`,
// like the attach door's Tier 0 rows, waiting on a verb. No caller asks.
//
// Postgres: `pg_stat_statements` counters diffed against the snapshot kept last
// time, so the first read only keeps a baseline. D1: Cloudflare already keeps
// the query insights (31 days), so the first read proposes from the day before
// the attach; `observe_from` keeps the ISO hour the next window starts at.
// A proposal whose DDL the DB already has a ledger row for — proposed,
// applied, rejected or reverted — is skipped: a reject or a revert is never
// re-proposed.

import {
  observeD1Workload,
  observePostgresWorkload,
  type Proposal,
  readD1QueryInsights,
  type StatementCounters,
  type StatementSnapshot,
  snapshotPostgresStatements,
  statementWindow,
} from "@nlqdb/db";
import { BYO_SECRET_REF_SENTINEL } from "./db-connect/constants.ts";
import { proposalStatement } from "./dba-changes.ts";
import { attachedD1, type DecideDeps, onAttached } from "./dba-verbs.ts";

// One day: a window spans the app's daily cycle.
export const OBSERVE_WINDOW_SEC = 24 * 3600;
// DBs per tick, under Workers Free's 50 subrequests: a Postgres DB is one
// socket, a D1 up to four requests (insights, plans, and for a scan its catalog
// and index keys) — more when a text no longer plans and each is sent alone;
// an overrun DB fails and is retried.
// Hourly, that is 120 DBs a day before a window stretches past 24 h.
const OBSERVE_BATCH = 5;
// D1 keeps query insights 31 days; a window starts a day inside that.
const D1_RETENTION_SEC = 30 * 24 * 3600;

type DueRow = { dbId: string; engine: string; blob: string | null; observeFrom: string | null };

// An ISO hour, the unit D1's analytics filter on.
const isoHour = (sec: number) => `${new Date(sec * 1000).toISOString().slice(0, 13)}:00:00Z`;

// The baseline without query text — the window takes it from the fresh read —
// so a DB with thousands of fingerprints still fits its D1 row. A baseline kept
// before `rows` was counted reads it as 0: the window's rows per call then run
// high, so a parameter-bound range reads unselective, never proposed on a guess.
type Baseline = Record<
  string,
  [calls: number, totalMs: number, sumSquaresMs: number, rows?: number]
>;

const toBaseline = (s: StatementSnapshot): Baseline =>
  Object.fromEntries([...s].map(([fp, c]) => [fp, [c.calls, c.totalMs, c.sumSquaresMs, c.rows]]));

const fromBaseline = (b: Baseline): StatementSnapshot =>
  new Map(
    Object.entries(b).map(
      ([fp, [calls, totalMs, sumSquaresMs, rows = 0]]): [string, StatementCounters] => [
        fp,
        { query: "", calls, totalMs, sumSquaresMs, rows },
      ],
    ),
  );

// Observes each attached Postgres or D1 DB whose window has passed (or that
// has not been observed yet), oldest first, and returns the ledger ids it
// recorded per DB. A DB that can't be read (unreachable, no
// `pg_stat_statements`, a refused token) keeps its window start and is
// retried a window later, behind the rest.
export async function observeDue(
  deps: DecideDeps,
  nowSec: number,
): Promise<{ dbId: string; proposalIds: number[] }[]> {
  // Checked once, not per DB: a missing KEK must not push every DB a day back.
  if (!deps.kek) {
    console.error(JSON.stringify({ msg: "dba_observe_failed", message: "sealing unconfigured" }));
    return [];
  }
  const { results } = await deps.d1
    .prepare(
      "SELECT id AS dbId, engine, connection_blob AS blob, observe_from AS observeFrom FROM databases WHERE engine IN ('postgres', 'd1') AND connection_secret_ref = ? AND connection_blob IS NOT NULL AND COALESCE(observed_at, 0) <= ? ORDER BY COALESCE(observed_at, 0), id LIMIT ?",
    )
    .bind(BYO_SECRET_REF_SENTINEL, nowSec - OBSERVE_WINDOW_SEC, OBSERVE_BATCH)
    .all<DueRow>();
  const observed: { dbId: string; proposalIds: number[] }[] = [];
  for (const row of results) {
    try {
      const { next, proposals } =
        row.engine === "d1" ? await observeD1(deps, row, nowSec) : await observePostgres(deps, row);
      const { results: seen } = await deps.d1
        .prepare("SELECT ddl FROM dba_changes WHERE database_id = ?")
        .bind(row.dbId)
        .all<{ ddl: string }>();
      const known = new Set(seen.map((s) => s.ddl));
      const fresh = proposals.filter((p) => !known.has(p.ddl));
      // The rows and the new baseline in one batch: a failed write keeps the
      // old baseline, so the next observe's window still covers this one.
      const [, ...ledger] = await deps.d1.batch([
        deps.d1
          .prepare("UPDATE databases SET observe_from = ?, observed_at = ? WHERE id = ?")
          .bind(next, nowSec, row.dbId),
        ...fresh.map((p) => proposalStatement(deps.d1, row.dbId, p)),
      ]);
      observed.push({
        dbId: row.dbId,
        proposalIds: ledger.map((r) => Number(r.meta.last_row_id)),
      });
    } catch (err) {
      await deps.d1
        .prepare("UPDATE databases SET observed_at = ? WHERE id = ?")
        .bind(nowSec, row.dbId)
        .run()
        .catch(() => {});
      console.error(
        JSON.stringify({
          msg: "dba_observe_failed",
          dbId: row.dbId,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return observed;
}

type Observed = { next: string; proposals: Proposal[] };

async function observePostgres(deps: DecideDeps, row: DueRow): Promise<Observed> {
  return onAttached(deps, row, async (query) => {
    const snapshot = await snapshotPostgresStatements(query, "public");
    const next = JSON.stringify(toBaseline(snapshot));
    if (!row.observeFrom) return { next, proposals: [] };
    const window = statementWindow(fromBaseline(JSON.parse(row.observeFrom)), snapshot);
    return { next, proposals: await observePostgresWorkload(query, "public", window) };
  });
}

// The insights from the hour the last window ended (the day before, at first)
// to this one's; the hour shared by two windows only re-proposes known DDL.
async function observeD1(deps: DecideDeps, row: DueRow, nowSec: number): Promise<Observed> {
  const { target, batch } = await attachedD1(deps, row);
  const oldest = isoHour(nowSec - D1_RETENTION_SEC);
  const from = row.observeFrom ?? isoHour(nowSec - OBSERVE_WINDOW_SEC);
  const window = { since: from < oldest ? oldest : from, until: isoHour(nowSec) };
  const insights = await (deps.readD1Insights ?? readD1QueryInsights)(target, window);
  return { next: window.until, proposals: await observeD1Workload(batch, insights) };
}
