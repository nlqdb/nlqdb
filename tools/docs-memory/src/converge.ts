// Convergent read-before-write planning — the D-02b half of the docs→memory
// re-sync. `facts` rows are append-only (`remember.ts` has no fact-update
// verb), so an idempotent re-sync must **read the current index first** and
// write only what differs. This module is the pure core of that: given the
// facts already stored (keyed by their `source.key → source.digest`) and a
// fresh extraction, it decides exactly which facts to write. No network, no
// LLM, no secret — fully testable offline, which is what lets the idempotency
// guarantee ("a second run over an unchanged corpus writes 0 rows") be a
// measured unit test rather than an assertion.
//
// Read verb (the D-02b design question, decided here per GLOBAL-033):
// **`/v1/run` with a keyed `SELECT` over `facts`** — no new endpoint. It works
// because both sides default to the same scope: `nlqdb_remember` server-
// defaults `agentId` to the tenant principal, and `buildHostedExecSteps`
// defaults `scope = { agentId: tenantId }` for a plain `/v1/run`
// (`apps/api/src/ask/build-deps.ts`). So the SK-PIVOT-009 RESTRICTIVE RLS on
// `facts` lets a `/v1/run` SELECT see exactly the rows a default-scope
// `remember` wrote. Option (b) — a new keyed `facts`-read verb — is rejected:
// it adds an endpoint for a read `/v1/run` already serves (P5, GLOBAL-015).
//
// Docs: docs/features/agent-memory-pivot/worksheets/dogfood/D-02-resync-hook.md

import type { Extraction, MemoryEntity, MemoryFact } from "./extract.ts";

/** The read that backs convergence: every stored fact's `source` blob. The
 * default tenant scope (see the module note) makes this see the corpus a
 * default-scope `remember` wrote. `source` is JSONB, so a driver returns it as
 * an object; a stringified column is tolerated by `existingFromRows`. */
export const FACTS_READ_SQL = 'SELECT "source" FROM "facts" WHERE "source" IS NOT NULL';

/** `source.key → source.digest` for every fact already in the index. */
export type ExistingFacts = Map<string, string>;

export type WritePlan = {
  /** Entities upsert on (agent, kind, name) — always safe to re-send, never a
   * new row (`remember.ts`), so they carry no digest and are not diffed. */
  entities: MemoryEntity[];
  /** Facts whose key is new, or whose value changed since last sync. */
  factsToWrite: MemoryFact[];
  /** Facts already stored with a matching digest — skipped, the idempotency
   * that keeps criterion 1's call count meaning "real work". */
  factsUnchanged: MemoryFact[];
};

/** Build the `key → digest` map from `/v1/run` rows (`SELECT source …`). */
export function existingFromRows(rows: Array<Record<string, unknown>>): ExistingFacts {
  const map: ExistingFacts = new Map();
  for (const row of rows) {
    const raw = row["source"];
    const source = typeof raw === "string" ? safeParse(raw) : raw;
    if (!source || typeof source !== "object") continue;
    const { key, digest } = source as { key?: unknown; digest?: unknown };
    if (typeof key === "string" && typeof digest === "string") map.set(key, digest);
  }
  return map;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The convergence decision. Pure: `planWrites(existing, ex)` twice with the
 * second `existing` reflecting the first run's writes yields an empty
 * `factsToWrite` — the measured idempotency (see `converge.test.ts`). */
export function planWrites(existing: ExistingFacts, ex: Extraction): WritePlan {
  const factsToWrite: MemoryFact[] = [];
  const factsUnchanged: MemoryFact[] = [];
  for (const fact of ex.facts) {
    if (existing.get(fact.source.key) === fact.source.digest) factsUnchanged.push(fact);
    else factsToWrite.push(fact);
  }
  return { entities: ex.entities, factsToWrite, factsUnchanged };
}
