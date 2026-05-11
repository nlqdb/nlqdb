// WS5 fixes A + B — small route-handler primitives for the `/v1/ask`
// prelude:
//
//   * `kickoffAskPrelude` (fix A) fires the D1 listDatabases and the
//     KV recent-tables reads together so they overlap on the cold
//     path. Returns the pending promises; callers await each at the
//     point its data is needed (both feed routeAsk's input).
//   * `resolveAnonEngineOverride` (fix B) picks the engine the
//     orchestrator should run with — explicit `body.engine` always
//     wins; an anonymous principal with no explicit value pins to
//     postgres so the cheap-tier `classifyEngine` LLM call is
//     skipped (SK-DB-002 ships postgres only in Phase 0/1; the
//     SK-DB-010 override seam already enforces no-mock-call when
//     `args.engine` is set — see `db-create/orchestrate.ts` step 0
//     and `test/engine-classify.test.ts`). Authenticated principals
//     fall through to the classifier so they remain free to grow
//     into BYO Phase-4 engines later.
//
// SK-ANON-006 keeps `principal.kind` out of the orchestrator. These
// helpers live alongside the other route-layer anon-conditional
// glue (`apps/api/src/anon-create-gate.ts`).

import type { Engine } from "@nlqdb/db";
import type { DatabaseSummaryRow } from "../databases/list.ts";
import type { RecentTable } from "./recent-tables.ts";

export type AskPreludeDeps = {
  listDatabases: (principalId: string) => Promise<DatabaseSummaryRow[]>;
  loadRecentTables: (principalId: string) => Promise<RecentTable[]>;
};

export type AskPrelude = {
  listPromise: Promise<DatabaseSummaryRow[]>;
  recentTablesPromise: Promise<RecentTable[]>;
};

export function kickoffAskPrelude(deps: AskPreludeDeps, principalId: string): AskPrelude {
  return {
    listPromise: deps.listDatabases(principalId),
    recentTablesPromise: deps.loadRecentTables(principalId),
  };
}

export function resolveAnonEngineOverride(
  bodyEngine: Engine | undefined,
  principalKind: "anon" | "user" | "pk_live",
): Engine | undefined {
  if (bodyEngine !== undefined) return bodyEngine;
  if (principalKind === "anon") return "postgres";
  return undefined;
}
