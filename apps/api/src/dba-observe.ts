// The scheduled Tier 1 observer (`GLOBAL-043` item 7): the `dba_observe` job
// reads each attached Postgres DB's `pg_stat_statements` counters, diffs them
// against the snapshot it kept last time, and records the window's
// `create_index` proposals in the ledger — `proposed`, like the attach door's
// Tier 0 rows, waiting on a verb. No caller asks.
//
// The first read only keeps a baseline; each later one, once the window has
// passed, proposes and rolls the baseline forward. A proposal whose DDL the DB
// already has a ledger row for — proposed, applied, rejected or reverted — is
// skipped: a reject or a revert is never re-proposed.

import {
  observePostgresWorkload,
  type StatementCounters,
  type StatementSnapshot,
  snapshotPostgresStatements,
  statementWindow,
} from "@nlqdb/db";
import { BYO_SECRET_REF_SENTINEL } from "./db-connect/constants.ts";
import { proposalStatement } from "./dba-changes.ts";
import { type DecideDeps, onAttached } from "./dba-verbs.ts";

// One day: a window spans the app's daily cycle.
export const OBSERVE_WINDOW_SEC = 24 * 3600;
// DBs per tick: each opens a socket to a user's DB (Workers' subrequest cap).
// Hourly, that is 120 DBs a day before a window stretches past 24 h.
const OBSERVE_BATCH = 5;

type DueRow = { dbId: string; blob: string | null; observeFrom: string | null };

// The baseline without query text — the window takes it from the fresh read —
// so a DB with thousands of fingerprints still fits its D1 row.
type Baseline = Record<string, [calls: number, totalMs: number, sumSquaresMs: number]>;

const toBaseline = (s: StatementSnapshot): Baseline =>
  Object.fromEntries([...s].map(([fp, c]) => [fp, [c.calls, c.totalMs, c.sumSquaresMs]]));

const fromBaseline = (b: Baseline): StatementSnapshot =>
  new Map(
    Object.entries(b).map(([fp, [calls, totalMs, sumSquaresMs]]): [string, StatementCounters] => [
      fp,
      { query: "", calls, totalMs, sumSquaresMs },
    ]),
  );

// Observes each attached Postgres DB whose window has passed (or that has no
// baseline yet), oldest first, and returns the ledger ids it recorded per DB.
// A DB that can't be read (unreachable, no `pg_stat_statements`) keeps its
// baseline and is retried a window later, behind the rest.
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
      "SELECT id AS dbId, connection_blob AS blob, observe_from AS observeFrom FROM databases WHERE engine = 'postgres' AND connection_secret_ref = ? AND connection_blob IS NOT NULL AND COALESCE(observed_at, 0) <= ? ORDER BY COALESCE(observed_at, 0), id LIMIT ?",
    )
    .bind(BYO_SECRET_REF_SENTINEL, nowSec - OBSERVE_WINDOW_SEC, OBSERVE_BATCH)
    .all<DueRow>();
  const observed: { dbId: string; proposalIds: number[] }[] = [];
  for (const row of results) {
    try {
      const { snapshot, proposals } = await onAttached(deps, row, async (query) => {
        const snapshot = await snapshotPostgresStatements(query, "public");
        if (!row.observeFrom) return { snapshot, proposals: [] };
        const window = statementWindow(fromBaseline(JSON.parse(row.observeFrom)), snapshot);
        return { snapshot, proposals: await observePostgresWorkload(query, "public", window) };
      });
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
          .bind(JSON.stringify(toBaseline(snapshot)), nowSec, row.dbId),
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
