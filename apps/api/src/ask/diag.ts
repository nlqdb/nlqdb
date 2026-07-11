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
// Pure storage over `KVStore` (the plan-cache split): the consumer
// (orchestrate.ts) owns the `nlqdb.diag.write` span and swallows
// failures — a diagnostic write must never change the error path.

import type { KVStore } from "../kv-store.ts";

export const DIAG_KEY_PREFIX = "diag:exec_db_unreachable:";

// One week: long enough to pull after a weekend e2e run, short enough
// that the shared namespace never accumulates (failure-path volume is
// a handful of rows per bad run).
export const DIAG_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ExecUnreachableDiag = {
  pgCode: string;
  pgMessage: string;
  dbId: string;
  cacheHit: boolean;
  planModel: string;
};

export type DiagSink = {
  record(entry: ExecUnreachableDiag): Promise<void>;
};

// `source` stamps which deployment wrote the row (`NODE_ENV`:
// "preview" vs "production") so a pull can attribute rows to an e2e
// dispatch without guessing from timestamps.
export function makeKvDiagSink(store: KVStore, source: string): DiagSink {
  return {
    async record(entry) {
      const ts = new Date().toISOString();
      // Timestamp-prefixed keys list in time order; the random suffix
      // keeps two failures in the same millisecond from colliding.
      const rand = Math.random().toString(16).slice(2, 8);
      await store.put(
        `${DIAG_KEY_PREFIX}${ts}:${rand}`,
        JSON.stringify({ ts, source, ...entry }),
        { expirationTtl: DIAG_TTL_SECONDS },
      );
    },
  };
}
