// SK-ASK-011 — speculative create on probable-0-dbs.
//
// When the cached signal suggests "this principal has 0 dbs," the
// route handler kicks off `startSpeculativeCreate` in parallel with
// the authoritative `listDatabasesForTenant` D1 read. The reconciler
// (../ask/reconcile-speculative.ts) commits when D1 confirms 0 dbs,
// or calls `rollback()` when D1 returns ≥1 — running
// `dropSchemaAndRegistry` (SK-HDC-011) and evicting the request's
// `Idempotency-Key` dedupe entry.
//
// No mid-create abort: Postgres transactions on Workers can't be
// cancelled cleanly across an LLM-tier latency window. `rollback()`
// awaits `result` to resolve, then compensates only if the create
// succeeded. Rollback is post-COMMIT compensation, idempotent, and
// best-effort.
//
// Spans + metrics (per `docs/performance.md` §3.1, §3.2):
//   • `nlqdb.create.speculative.start`     (parent span)
//   • `nlqdb.create.speculative.rollback`  (child span on rollback)
//   • counters: start_total / commit_total / rollback_total
//   • histogram: overhead_ms (set by the reconciler — this module
//     reports the timestamp at which `result` resolved so the
//     reconciler can compute the delta).

import { createSpeculativeRollbackTotal, createSpeculativeStartTotal } from "@nlqdb/otel";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { dropSchemaAndRegistry } from "./neon-provision.ts";
import { type DbCreateDeps, orchestrateDbCreate } from "./orchestrate.ts";
import type { DbCreateArgs, DbCreateResult } from "./types.ts";

// Forward-looking interface for the `Idempotency-Key` dedupe store
// (per `docs/features/idempotency/FEATURE.md` SK-IDEMP-005). The
// general-purpose middleware that owns the store is open work; this
// interface defines just the slice the speculative rollback needs:
// delete an entry by `(principalId, key)` so a retry runs the
// disambiguate path instead of replaying a rolled-back create
// response.
//
// When the middleware lands, its store implementation should
// implement this same shape — keep the interface here so this module
// can be wired through `build-deps.ts` ahead of the middleware.
export type IdempotencyStore = {
  delete(principalId: string, idempotencyKey: string): Promise<void>;
};

export type SpeculativeDeps = DbCreateDeps & {
  // When omitted, rollback skips dedupe-eviction (no-op). The route
  // handler today does NOT yet wire a store (the middleware ships
  // separately); this leaves the contract in place so the eviction
  // path is exercised end-to-end the moment the store lands.
  idempotencyStore?: IdempotencyStore;
};

export type SpeculativeArgs = DbCreateArgs & {
  // Principal id is needed for both the rollback metric label and
  // the idempotency-store delete key. `principalKind` distinguishes
  // anon vs user for the dashboard; SK-ANON-006 still applies — no
  // conditional branching on kind in the orchestrator.
  principalId: string;
  principalKind: "anon" | "user";
};

export type SpeculativeHandle = {
  // Resolves with the speculative create's outcome. Awaited by both
  // `rollback()` (for compensation) and the reconciler (for commit).
  result: Promise<DbCreateResult>;
  // Timestamp captured the moment `result` resolves. Reconciler
  // subtracts the authoritative-done timestamp to fill in
  // `nlqdb.create.speculative.overhead_ms`.
  speculativeDoneAt: Promise<number>;
  // Post-COMMIT compensation. Awaited internally if `result` is
  // still pending — we never abort mid-create.
  rollback(opts?: { idempotencyKey?: string; reason?: RollbackReason }): Promise<void>;
};

export type RollbackReason = "dbs_appeared" | "list_failed" | "create_failed_after_speculation";

export function startSpeculativeCreate(
  deps: SpeculativeDeps,
  args: SpeculativeArgs,
): SpeculativeHandle {
  const tracer = trace.getTracer("@nlqdb/api/db-create");

  // SK-OBS-005 — span the full speculative kick-off so the trace UI
  // shows the parallel branch alongside `nlqdb.ask`. The span ends
  // on result-settle (success or failure); rollback opens its own
  // child span.
  const startSpan = tracer.startSpan("nlqdb.create.speculative.start", {
    attributes: { "nlqdb.principal_kind": args.principalKind },
  });
  createSpeculativeStartTotal().add(1, { principal_kind: args.principalKind });

  let resolveDoneAt: (ts: number) => void = () => {};
  const speculativeDoneAt: Promise<number> = new Promise((res) => {
    resolveDoneAt = res;
  });

  const result: Promise<DbCreateResult> = (async () => {
    try {
      const out = await orchestrateDbCreate(deps, args);
      if (!out.ok) {
        startSpan.setAttribute("nlqdb.create.speculative.outcome", "create_failed");
        startSpan.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        startSpan.setAttribute("nlqdb.create.speculative.outcome", "create_ok");
      }
      return out;
    } catch (err) {
      // The reconciler treats a thrown speculative as
      // create_failed_after_speculation (no-op rollback). Record
      // here so the trace shows the cause.
      startSpan.recordException(err as Error);
      startSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      resolveDoneAt(performance.now());
      startSpan.end();
    }
  })();

  let rollbackInFlight: Promise<void> | undefined;

  const rollback: SpeculativeHandle["rollback"] = async (opts) => {
    // Idempotent: a second rollback() call awaits the first and
    // returns. The actual DROP/DELETE/dedupe-evict run once.
    if (rollbackInFlight) {
      await rollbackInFlight;
      return;
    }
    rollbackInFlight = (async () => {
      const reason: RollbackReason = opts?.reason ?? "dbs_appeared";
      const rollbackSpan = tracer.startSpan("nlqdb.create.speculative.rollback", {
        attributes: {
          "nlqdb.principal_kind": args.principalKind,
          "nlqdb.create.speculative.rollback_reason": reason,
        },
      });
      try {
        // Wait for the in-flight create to settle — Postgres tx on
        // Workers can't be cancelled mid-flight. If it threw,
        // there's nothing to compensate.
        let settled: DbCreateResult;
        try {
          settled = await result;
        } catch {
          createSpeculativeRollbackTotal().add(1, {
            principal_kind: args.principalKind,
            reason: "create_failed_after_speculation",
          });
          return;
        }
        if (!settled.ok) {
          // Create failed cleanly — orchestrator already rolled
          // back its own transaction. No schema, no registry row,
          // nothing to drop.
          createSpeculativeRollbackTotal().add(1, {
            principal_kind: args.principalKind,
            reason: "create_failed_after_speculation",
          });
          return;
        }

        // Create succeeded → undo it. SK-HDC-011 primitive.
        await dropSchemaAndRegistry(tracer, deps.pg, deps.d1, settled.dbId, settled.schemaName);

        // Idempotency eviction (per worksheet § "Idempotency
        // eviction"). When the store dep is absent (today's
        // default — middleware not yet wired), this is a no-op.
        if (opts?.idempotencyKey && deps.idempotencyStore) {
          try {
            await deps.idempotencyStore.delete(args.principalId, opts.idempotencyKey);
          } catch (err) {
            // Eviction failure is best-effort: the dedupe entry
            // becomes stale, which surfaces as a wrong-but-
            // consistent retry response. Log on the span so the
            // dashboard catches it; don't propagate.
            rollbackSpan.recordException(err as Error);
          }
        }

        createSpeculativeRollbackTotal().add(1, {
          principal_kind: args.principalKind,
          reason,
        });
      } catch (err) {
        rollbackSpan.recordException(err as Error);
        rollbackSpan.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        rollbackSpan.end();
      }
    })();
    await rollbackInFlight;
  };

  return { result, speculativeDoneAt, rollback };
}
