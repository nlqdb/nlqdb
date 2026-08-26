// Granted-ask composition (SK-EKP-008, EK-06 box 2 — the schema-only planning
// half). `executeGrantedRead` (grant-orchestrate.ts) takes `rawSql` as given and
// owns resolve → guardrails → run → meter → rows-only below it. THIS module owns
// the half above it: turn a buyer's natural-language goal into the read SQL that
// executor runs — planned against the OWNER's schema, never the buyer's, and
// NEVER over the owner's cell values. That is the whole trust claim: the
// buyer-query path is schema-only (GLOBAL-037 / SK-EKP-001), so a granted ask
// sends the owner's table + column names to the planner and gets rows back
// un-narrated, with no owner cell value ever reaching an LLM. So the forthcoming
// cross-tenant `/v1/ask` branch reduces to: `orchestrateGrantedAsk` → render the
// returned rows as `Accept: application/json` would (no summarize seam).
//
// Why plan lives ABOVE `executeGrantedRead`, not inside it: the planner needs the
// owner DB's schema text, which only the resolve leg (`resolveGrantedRead`)
// produces. So this composition resolves once — for the owner schema — plans,
// then delegates the audited resolve → guardrail → run → meter flow to
// `executeGrantedRead` unchanged. The executor's own internal resolve is a
// status-cache hit within the ≤30 s revocation bound (grant-status.ts) plus a
// point read, so the second resolve costs ~nothing and keeps the executor's
// reviewed "one call" shape untouched (no churn on freshly-shipped tested code).
//
// Pure by construction over injected I/O — no D1, env, PG, or LLM — so the full
// matrix is unit-testable without a live DB (the grant-orchestrate.ts idiom). The
// caller wires:
//   - `io`         = `grantedReadIo(d1)` (grant-ask-wire.ts) — the production
//     `GrantedReadIo` the executor composes,
//   - `planReadSql`= a schema-only wrapper over `deps.llm.plan` (owner schema in,
//     read SQL out — the buyer's goal never sees an owner row).

import { schemaRelativeSql } from "./ask/plan-normalize.ts";
import {
  executeGrantedRead,
  type GrantedReadIo,
  type GrantedReadResult,
} from "./grant-orchestrate.ts";
import { resolveGrantedRead } from "./grant-resolve.ts";

export type GrantedAskDeps = {
  // The production `GrantedReadIo` the executor composes (resolve grant behind
  // the status cache, resolve owner DB, run the exec batch, meter). This module
  // reuses its two resolvers to fetch the owner schema for planning, then hands
  // the whole io to `executeGrantedRead`.
  io: GrantedReadIo;
  // Schema-only planner: (goal, ownerSchemaText) → read SQL. Injected so this
  // composition is testable without an LLM; production wraps `deps.llm.plan`
  // with the owner DB's `schemaText` as the `schema` field. GLOBAL-037: owner
  // SCHEMA in, never owner rows — enforced by construction (this only ever
  // receives the owner's `schemaText`, never a resolved row).
  planReadSql: (goal: string, ownerSchemaText: string) => Promise<string>;
};

export type GrantedAskInput = {
  buyerTenantId: string;
  requestedDbId: string;
  goal: string;
  // The client's `Idempotency-Key`, threaded through to the meter. Omitted ⇒
  // the executor synthesizes and persists one so the usage record (and the fee
  // event later keyed on it) is idempotent under retry.
  idempotencyKey?: string;
};

// The owner DB row exists and the grant is live, but the owner's schema has not
// been compiled yet (a legacy or never-populated DB). There is nothing for the
// planner to write SQL against — fail closed rather than plan blind. Mirrors
// orchestrateAsk's `schema_unavailable` for the buyer's own DB path.
export type GrantedAskSchemaUnavailable = { ok: false; reason: "schema_unavailable" };

// Exactly the executor's result union (rows-only ok, or a typed fail-closed
// resolve/scope reject) plus the pre-plan `schema_unavailable`. The route maps
// this one union to a response.
export type GrantedAskResult = GrantedReadResult | GrantedAskSchemaUnavailable;

// Run a buyer's granted cross-tenant ask end to end: resolve the live grant +
// owner DB, plan the goal against the OWNER's schema (schema-only), then execute
// through the audited granted-read executor and return the owner's rows
// UN-NARRATED. Every negative answer fails closed before any owner DB is read or
// any usage is metered.
export async function orchestrateGrantedAsk(
  input: GrantedAskInput,
  deps: GrantedAskDeps,
): Promise<GrantedAskResult> {
  const { io, planReadSql } = deps;

  // 1. Resolve — is this a live cross-tenant grant, and on which owner DB? This
  //    read is only to obtain the owner's schema for planning; the executor
  //    re-resolves (status-cache hit) as the authoritative pre-exec check.
  const resolved = await resolveGrantedRead({
    buyerTenantId: input.buyerTenantId,
    requestedDbId: input.requestedDbId,
    resolveActiveGrant: io.resolveActiveGrant,
    resolveOwnerDb: io.resolveOwnerDb,
  });
  if (!resolved.ok) return resolved;

  // 2. A live grant on a DB with no compiled schema — nothing to plan against.
  if (!resolved.ownerDb.schemaText) return { ok: false, reason: "schema_unavailable" };

  // 3. Plan the buyer's goal against the OWNER's schema — schema tokens only,
  //    never owner cell values (GLOBAL-037). Normalise to schema-relative form
  //    (strip the owner schema qualifier) so the executed SQL resolves via the
  //    owner `search_path` the exec batch sets — and, load-bearing, so
  //    `validateGrantScope` sees bare table names matching the grant's scope
  //    (SK-ASK-025 applied to the owner schema).
  const planned = await planReadSql(input.goal, resolved.ownerDb.schemaText);
  const rawSql = schemaRelativeSql(planned, resolved.schemaName);

  // 4. Execute through the audited executor: resolve (cached) → scope guardrail
  //    → non-owner role + owner RLS → run → meter → rows-only. A scope reject
  //    fails closed here, before any statement runs.
  return executeGrantedRead(
    {
      buyerTenantId: input.buyerTenantId,
      requestedDbId: input.requestedDbId,
      rawSql,
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    },
    io,
  );
}
