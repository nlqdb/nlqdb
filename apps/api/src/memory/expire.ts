// E-04 — agent-memory TTL sweep. The deterministic, offline-tested core
// of the daily expiry job: build the parameterised DELETE, run it across
// the memory-preset DBs with per-DB failure isolation, and aggregate the
// counts the OTel metric will report. Staged ahead of the two remaining
// halves: the cron wiring that drives it (a `wrangler.toml` `[triggers]`
// entry + a `scheduled()` branch — plain code, deploys with the Worker;
// no human step) and the read-side TTL *invisibility*
// (an `AND (expires_at IS NULL OR expires_at > NOW())` clause on E-03's
// `facts` RLS `USING` policy — E-03-gated). Same shape as E-02, which
// shipped `buildRememberInsert` ahead of its e2e wiring.
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
import { isAgentMemoryV1Db } from "./remember.ts";

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
