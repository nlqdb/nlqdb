// Durable exec diagnostics for the `/v1/ask` catch-all (SK-ASK-023).
//
// Workers preview versions — the e2e staging surface — emit no logs
// anywhere: Workers Logs, `wrangler tail`, and Logpush all skip
// preview-URL invocations. SK-ASK-019-style structured console lines
// therefore vanish exactly where the intermittent exec failures happen.
// KV *is* shared between previews and the deployed worker, so one
// TTL'd KV write per catch-all failure keeps the SQLSTATE pullable
// offline (CF REST API / wrangler) for 7 days.
//
// Pure storage over `KVStore` (the plan-cache split): each consumer
// (orchestrate.ts, anon-adopt-regrant.ts) owns its `nlqdb.diag.write`
// span and swallows failures — a diagnostic write must never change
// the error path.

import { redactPii } from "@nlqdb/otel";
import type { KVStore } from "../kv-store.ts";

export const DIAG_KEY_PREFIX = "diag:";

// One week: long enough to pull after a weekend e2e run, short enough
// that the shared namespace never accumulates (failure-path volume is
// a handful of rows per bad run).
export const DIAG_TTL_SECONDS = 7 * 24 * 60 * 60;

// Storm guard — a DB outage fires the exec catch-all on every failing
// request, and the shared namespace's free-tier write quota (1 k/day,
// also the plan cache's — GLOBAL-013) must survive one: cap rows per
// isolate per minute. Excess failures still hit the span/console path.
export const DIAG_MAX_WRITES_PER_WINDOW = 5;
const WINDOW_MS = 60_000;
let windowStartMs = 0;
let writesInWindow = 0;

export function resetDiagWriteWindowForTest(): void {
  windowStartMs = 0;
  writesInWindow = 0;
}

// One entry per swallowed-failure class whose console line a preview
// drops. Adding a class = adding a union member + the `record` call in
// its catch; the key prefix `diag:<event>:` keeps classes list-separable.
export type DiagEntry = {
  event:
    | "exec_db_unreachable"
    | "anon_adopt_regrant_failed"
    | "exec_acl_heal_failed"
    | "schema_mismatch";
  pgCode: string;
  pgMessage: string;
  dbId: string;
  cacheHit?: boolean;
  planModel?: string;
};

export type DiagSink = {
  record(entry: DiagEntry): Promise<void>;
};

// `source` stamps which deployment wrote the row (`NODE_ENV`:
// "preview" vs "production") so a pull can attribute rows to an e2e
// dispatch without guessing from timestamps.
export function makeKvDiagSink(store: KVStore, source: string): DiagSink {
  return {
    async record(entry) {
      const now = Date.now();
      if (now - windowStartMs >= WINDOW_MS) {
        windowStartMs = now;
        writesInWindow = 0;
      }
      if (++writesInWindow > DIAG_MAX_WRITES_PER_WINDOW) return;
      const ts = new Date(now).toISOString();
      // Timestamp-prefixed keys list in time order; the random suffix
      // keeps two failures in the same millisecond from colliding.
      const rand = Math.random().toString(16).slice(2, 8);
      // PG messages can echo user literals (unique-violation details,
      // input-syntax errors) — redact before the row outlives the
      // request, per the SK-OBS-008 posture on exported diagnostics.
      await store.put(
        `${DIAG_KEY_PREFIX}${entry.event}:${ts}:${rand}`,
        JSON.stringify({ ts, source, ...entry, pgMessage: redactPii(entry.pgMessage) }),
        { expirationTtl: DIAG_TTL_SECONDS },
      );
    },
  };
}
