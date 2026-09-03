// E-04 — agent-memory TTL sweep. The deterministic, offline-tested core
// of the daily expiry job: build the parameterised DELETE, run it across
// the memory-preset DBs with per-DB failure isolation, and aggregate the
// counts the OTel metric will report. The read-side half shipped with E-03
// (the `facts` `agent_isolation` policy carries the
// `expires_at IS NULL OR expires_at > now()` arm, SK-PIVOT-009), so expired
// rows are already invisible to reads before this sweep runs. Still
// remaining: the cron wiring that drives it (one row in
// `scheduled/jobs.ts`, SK-HDC-023, plus the owner-role exec adapter below).
//
// **The sweep must run as the schema OWNER, not through
// `buildHostedExecSteps`' `SET LOCAL ROLE`.** That TTL arm sits in a
// `FOR ALL` policy's `USING`, and Postgres applies SELECT/ALL policies to a
// `DELETE` that reads columns in its `WHERE` / `RETURNING`
// (postgresql.org/docs/17/sql-createpolicy.html, Table 297 note [a]) — so
// under the non-owner tenant role the expired rows this DELETE targets are
// filtered out of it and the sweep silently deletes nothing. The owner
// bypasses RLS, which is also what makes the cross-tenant cron possible at
// all.
//
// Why a server-built constant DELETE and not LLM SQL: identical trust
// boundary to remember (E-02) — the only thing consulted is
// `facts.expires_at` and the cutoff is a bound param, so the LLM never
// composes this. `facts` is the only table with `expires_at`;
// `episodes` / `entities` are append-only / long-lived (E-01 DDL) and so
// never expire — the same shape the write side enforces by rejecting a
// `ttlSeconds` on them (one-sentence error, GLOBAL-012).
//
// Sibling: `docs/features/agent-memory-pivot/worksheets/engine/E-04-ttl-decay.md`.

import { DbConfigError, type DbRecord, type QueryResult } from "../ask/types.ts";
import { isAgentMemoryV1Db } from "../db-create/presets/agent-memory-v1.ts";

export type MemorySweepPlan = {
  table: "facts";
  text: string;
  params: unknown[];
};

// `nowMs` is injected (mirrors `buildRememberInsert`) so the cutoff is
// deterministic in tests. `expires_at IS NOT NULL` is redundant with
// `< $1` (NULL fails the comparison) but states the intent — only rows
// that opted into a TTL are ever swept.
export function buildExpirySweep(nowMs: number): MemorySweepPlan {
  return {
    table: "facts",
    text: "DELETE FROM facts WHERE expires_at IS NOT NULL AND expires_at < $1 RETURNING id",
    params: [new Date(nowMs).toISOString()],
  };
}

export type SweepDbResult =
  | { dbId: string; ok: true; deleted: number }
  | { dbId: string; ok: false; error: "db_misconfigured" | "db_unreachable" };

export type SweepSummary = {
  // memory-preset DBs the sweep considered (non-memory DBs are skipped)
  scanned: number;
  // DBs the DELETE ran against without error
  swept: number;
  // total `facts` rows deleted across all swept DBs (the metric value)
  expiredRows: number;
  // DBs whose sweep errored — recorded, not thrown (isolation)
  failures: number;
  perDb: SweepDbResult[];
};

export type SweepDeps = {
  execMemory: (db: DbRecord, plan: MemorySweepPlan, signal?: AbortSignal) => Promise<QueryResult>;
  nowMs?: number;
};

// Pure given an injected exec. Sweeps only memory-preset DBs; one DB's
// failure is recorded and isolated so the remaining DBs still sweep
// (the worksheet's "scoped per-DB so failure is isolated" requirement).
export async function orchestrateSweep(deps: SweepDeps, dbs: DbRecord[]): Promise<SweepSummary> {
  const memoryDbs = dbs.filter((d) => isAgentMemoryV1Db(d.id));
  const plan = buildExpirySweep(deps.nowMs ?? Date.now());
  const perDb: SweepDbResult[] = [];
  let expiredRows = 0;
  let swept = 0;
  let failures = 0;

  for (const db of memoryDbs) {
    try {
      const result = await deps.execMemory(db, plan);
      perDb.push({ dbId: db.id, ok: true, deleted: result.rowCount });
      swept++;
      expiredRows += result.rowCount;
    } catch (err) {
      perDb.push({
        dbId: db.id,
        ok: false,
        error: err instanceof DbConfigError ? "db_misconfigured" : "db_unreachable",
      });
      failures++;
    }
  }

  return { scanned: memoryDbs.length, swept, expiredRows, failures, perDb };
}
