// SK-ASK-011 — speculative-create reconciler. Awaits the authoritative
// `listDatabasesForTenant` D1 read alongside the speculative create's
// settle, then either commits (D1 confirmed 0 dbs → return the
// speculative result) or rolls back (D1 returned ≥ 1 dbs → run
// `dropSchemaAndRegistry`, evict the dedupe entry, hand the dbs list
// to the disambiguate path).
//
// Fail-safe on D1 failure: per the worksheet's "D1 read fails" test,
// a list-failed reconciler rolls back rather than committing —
// preserves the user's existing dbs in the rare case where the cache
// signal was wrong AND D1 went down.

import { createSpeculativeCommitTotal, createSpeculativeOverheadMs } from "@nlqdb/otel";
import type { DatabaseSummaryRow } from "../databases/list.ts";
import type { SpeculativeHandle } from "../db-create/speculative.ts";
import type { DbCreateResult } from "../db-create/types.ts";

export type ReconcileInput = {
  speculative: SpeculativeHandle;
  // The promise the route handler already kicked off (mirrors
  // disambiguate-db.ts's prelude pattern). Resolves to the dbs the
  // tenant authoritatively has.
  authoritativeDbsPromise: Promise<DatabaseSummaryRow[]>;
  principalKind: "anon" | "user";
  // Optional — wired through to rollback's idempotency-eviction step.
  idempotencyKey?: string;
};

export type ReconcileResult =
  | { kind: "committed"; result: DbCreateResult }
  | { kind: "rolled_back"; dbs: DatabaseSummaryRow[] };

export async function reconcileSpeculativeCreate(input: ReconcileInput): Promise<ReconcileResult> {
  // Fetch the authoritative answer first. We don't await
  // `speculative.result` up-front — the rollback path inside
  // SpeculativeHandle does that — but for the commit path we need
  // to surface the create outcome.
  let dbs: DatabaseSummaryRow[];
  try {
    dbs = await input.authoritativeDbsPromise;
  } catch {
    // D1 read failed — fail safe: roll back the speculative create
    // rather than committing on a possibly-stale cache.
    await input.speculative.rollback({
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      reason: "list_failed",
    });
    return { kind: "rolled_back", dbs: [] };
  }

  const authoritativeDoneAt = performance.now();

  if (dbs.length === 0) {
    // Cache was right — commit. Surface the create outcome.
    // A throw here propagates up so the caller surfaces it as a
    // normal create error envelope.
    const result: DbCreateResult = await input.speculative.result;
    // Overhead histogram: negative = speculative finished first.
    const speculativeDoneAt = await input.speculative.speculativeDoneAt;
    createSpeculativeOverheadMs().record(speculativeDoneAt - authoritativeDoneAt, {
      principal_kind: input.principalKind,
    });
    if (result.ok) {
      createSpeculativeCommitTotal().add(1, { principal_kind: input.principalKind });
    }
    return { kind: "committed", result };
  }

  // D1 returned dbs we didn't expect — undo the speculative create
  // and let the disambiguate path take over.
  await input.speculative.rollback({
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    reason: "dbs_appeared",
  });
  return { kind: "rolled_back", dbs };
}
