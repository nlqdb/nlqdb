// SK-EVENTS-010 — emit the GLOBAL-024 demand-signal for the two
// orchestrator failure shapes that map to typed `feature.*` variants.
// Fire-and-forget through `ctx.waitUntil` so the 4xx isn't delayed.
// `rate_limited` here is the authed per-account D1 bucket trip, so it
// fires `feature.requested.larger_account` — NOT `heavier_tier`, which
// is reserved for the anon per-IP tier gates that emit at the route
// top-level, before `orchestrateAsk` runs (SK-EVENTS-010's two distinct
// rate-limit variants). The DDL reject set lives in `sql-validate.ts`
// next to `SqlRejectReason` so the two can't drift.

import type { EventEmitter, NlqSurface } from "@nlqdb/events";
import { DDL_REJECT_REASONS } from "./sql-validate.ts";
import type { AskError } from "./types.ts";

// Narrow `ExecutionContext` to just `waitUntil` so tests can pass a
// fake without needing the full Cloudflare runtime type.
export interface WaitUntilCtx {
  waitUntil(promise: Promise<unknown>): void;
}

export function emitFeatureSignal(
  emitter: EventEmitter,
  ctx: WaitUntilCtx,
  principalId: string,
  surface: NlqSurface,
  error: AskError,
): void {
  if (error.status === "sql_rejected" && DDL_REJECT_REASONS.has(error.reason)) {
    ctx.waitUntil(
      emitter.emit({
        name: "feature.requested.ddl_via_ask",
        principalId,
        surface,
        rejectReason: error.reason,
      }),
    );
    return;
  }
  if (error.status === "rate_limited") {
    ctx.waitUntil(
      emitter.emit({
        name: "feature.requested.larger_account",
        principalId,
        surface,
      }),
    );
  }
}
