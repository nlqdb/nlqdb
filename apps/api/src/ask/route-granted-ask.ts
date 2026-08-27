// EK-06 box 2 — the buyer's `/v1/ask` granted-read branch (SK-EKP-008). This is
// the single place the live route reduces to once a pinned dbId turns out NOT to
// be the buyer's own DB: run the audited cross-tenant read
// (`orchestrateGrantedAsk` — resolve the live grant → plan against the OWNER
// schema, schema-only → non-owner SELECT-only role under FORCE RLS → run → meter)
// and render the owner's rows UN-NARRATED. A granted read is schema-only end to
// end and never narrated (GLOBAL-037 / SK-EKP-001 / EK-09 box 2): there is no
// summarize seam, so expert cell values never transit an LLM on a cross-tenant
// query.
//
// Split out of the handler as a pure function over the injected orchestrator so
// the render/reject mapping — every branch of the result union to an HTTP-shaped
// `{status, body}` — is unit-tested without a live DB (the `grant-ask.ts` idiom).
// The handler wires the production deps (`grantedReadIo` + a schema-only
// `planReadSql` over the LLM router) and calls this on its `db_not_found` branch
// ONLY, so an own-DB ask never pays for the grant lookup.

import type { GrantedAskDeps, GrantedAskInput, GrantedAskResult } from "../grant-ask.ts";
import { orchestrateGrantedAsk } from "../grant-ask.ts";
import type { QueryResult } from "./types.ts";

export type GrantedAskRender =
  // The owner's rows, rows-only (no summary). The handler returns 200.
  | {
      served: "rows";
      status: 200;
      body: { granted: true; rows: QueryResult["rows"]; row_count: number };
    }
  // No live grant for this (buyer, DB). The handler falls back to its original
  // `db_not_found` — fail-closed, never confirming the DB exists to a non-grantee.
  | { served: "fallthrough" }
  // A live grant, but this read/DB cannot be served. A typed, honest envelope the
  // grantee is authorized to see: every case here required a live grant to reach.
  | {
      served: "error";
      status: 403 | 404 | 409;
      body: { error: string; reason?: string; detail?: string };
    };

// Map the granted-read result union to a render. Pure + exhaustive.
export function renderGrantedAsk(result: GrantedAskResult): GrantedAskRender {
  if (result.ok) {
    return {
      served: "rows",
      status: 200,
      body: { granted: true, rows: result.rows, row_count: result.rowCount },
    };
  }
  switch (result.reason) {
    // No grant → indistinguishable from "no such DB" to a non-grantee (fail-closed).
    case "no_grant":
      return { served: "fallthrough" };
    // The grant is live but its owner DB row is gone — the grantee may know that.
    case "owner_db_missing":
      return { served: "error", status: 404, body: { error: "grant_target_unavailable" } };
    // v1 brokers hosted Postgres only; a BYO / other-engine target can't be served.
    case "not_grantable":
      return { served: "error", status: 409, body: { error: "grant_not_supported" } };
    // The owner DB has no compiled schema yet — nothing to plan against.
    case "schema_unavailable":
      return { served: "error", status: 409, body: { error: "schema_unavailable" } };
    // A scope guardrail rejected the planned read (allowlist / write / out-of-scope).
    case "not_allowed":
    case "not_read_only":
    case "out_of_scope":
      return {
        served: "error",
        status: 403,
        body: {
          error: "grant_scope_denied",
          reason: result.reason,
          ...(result.detail !== undefined ? { detail: result.detail } : {}),
        },
      };
    default: {
      // Exhaustiveness: a new reject reason must add a render above.
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

// Run a buyer's granted cross-tenant read and render it. The handler calls this on
// its `db_not_found` branch for a tenant buyer; a `fallthrough` render means "not a
// grant for this buyer" and the handler returns its original `db_not_found`.
export async function tryGrantedRead(
  input: GrantedAskInput,
  deps: GrantedAskDeps,
): Promise<GrantedAskRender> {
  return renderGrantedAsk(await orchestrateGrantedAsk(input, deps));
}
