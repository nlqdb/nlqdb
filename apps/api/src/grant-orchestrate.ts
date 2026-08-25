// Granted-read EXECUTOR (SK-EKP-008, EK-06 box 2 — sub-piece (g), the
// execution keystone). The pure composition the forthcoming cross-tenant
// `/v1/ask` branch reduces to. Its three sibling keystones each own one leg:
// `grant-resolve.ts` (`resolveGrantedRead`) answers "is this a live grant, and
// on which owner DB"; `grant-read.ts` (`planGrantedRead`) answers "given the
// grant + schema, what exactly runs". THIS module owns the whole buyer-query
// flow end to end: resolve → plan → run the exec batch on the owner's DB →
// meter (only on a successful run) → return the owner's rows UN-NARRATED.
//
// Pure by construction over injected I/O — no D1, no env, no PG — so the full
// happy + reject + meter matrix is unit-testable without a live DB (the
// `grant-read.ts` / `grant-resolve.ts` idiom). The caller wires:
//   - `resolveActiveGrant` = `getActiveGrant` behind the ≤30 s status cache
//     (`grant-status.ts`), the NEW-query revocation bound,
//   - `resolveOwnerDb`   = the ordinary `db-registry.ts` `resolveDb`,
//   - `runExecSteps`     = the hosted transaction runner (which carries its own
//     `db.query` span + the IN-FLIGHT `statement_timeout` baked into the batch),
//   - `recordUsage`      = `grant-usage.ts` `recordGrantUsage`.
// So the route branch is one call to this plus a rows-only render.
//
// Three load-bearing contracts, all pinned by the tests:
//   1. FAIL-CLOSED, no early exec — every resolve/plan reject returns BEFORE
//      any exec batch runs and BEFORE any usage is metered. A rejected read
//      never touches the owner DB and never bills.
//   2. METER AFTER SUCCESS ONLY (SK-EKP-008 Q1) — `recordUsage` runs only after
//      the exec transaction resolves; a thrown exec propagates and meters
//      nothing ("a rejected or errored query emits nothing"). The billable unit
//      is the successfully-executed query, and the idempotency key (synthesized
//      + persisted when the client omits one) makes a retry record nothing new
//      (the `grant_usage` UNIQUE constraint) — the unit SK-PIVOT-023 axis-2
//      later bills against, keyed on this same key.
//   3. NARRATION SKIPPED (GLOBAL-037 / EK-09 box 2) — this returns rows, never
//      prose: it has no summarize seam, so expert cell values can never transit
//      the narration lane on a cross-tenant query. The route MUST render these
//      rows as `Accept: application/json` would, never feeding them to
//      `llm.summarize`.

import type { HostedExecStep } from "./ask/exec-steps.ts";
import type { DbRecord, QueryResult } from "./ask/types.ts";
import type { GrantReadReject } from "./grant-read.ts";
import { planGrantedRead } from "./grant-read.ts";
import type { GrantedReadResolveReject } from "./grant-resolve.ts";
import { resolveGrantedRead } from "./grant-resolve.ts";
import type { GrantUsageInput } from "./grant-usage.ts";
import type { GrantRecord } from "./grants.ts";

// The I/O the executor composes. Every member is injected so the pure decision
// flow is testable against fakes; production supplies the live wirings above.
export type GrantedReadIo = {
  resolveActiveGrant: (buyerTenantId: string, ownerDbId: string) => Promise<GrantRecord | null>;
  resolveOwnerDb: (dbId: string, ownerTenantId: string) => Promise<DbRecord | null>;
  // Runs the ordered exec batch in one transaction on the owner's DB and
  // returns the user statement's rows. Carries its own `db.query` span.
  runExecSteps: (ownerDb: DbRecord, execSteps: HostedExecStep[]) => Promise<QueryResult>;
  recordUsage: (input: GrantUsageInput) => Promise<{ recorded: boolean }>;
  // Synthesize an idempotency key when the client omits one. Injected so the
  // meter contract is deterministically testable; production wraps
  // `crypto.randomUUID`.
  newIdempotencyKey: () => string;
};

export type GrantedReadOk = {
  ok: true;
  // The owner's rows, un-narrated — the route renders these directly.
  rows: QueryResult["rows"];
  rowCount: number;
  // The authorizing grant, for (grant, buyer, seller) attribution downstream.
  grant: GrantRecord;
  // In-scope tables the read referenced (provenance / metering context).
  tables: string[];
  // The idempotency key the usage record was written under — the client's when
  // supplied, else the synthesized one. The route caches the response under it.
  idempotencyKey: string;
  // Whether THIS call created a fresh usage record. `false` on a replay (same
  // key already seen for this grant) — the read still returns, no double-count.
  usageRecorded: boolean;
};

// The reject is exactly one of the two typed rejects the legs already define,
// passed through unchanged so the route maps one union.
export type GrantedReadResult = GrantedReadOk | GrantedReadResolveReject | GrantReadReject;

// Execute a buyer's granted read end to end. `rawSql` is the planner's generated
// read (schema-relative; the batch bakes the owner's `search_path`); an omitted
// `idempotencyKey` is synthesized once, here, so the usage record is idempotent
// under retry.
export async function executeGrantedRead(
  input: {
    buyerTenantId: string;
    requestedDbId: string;
    rawSql: string;
    idempotencyKey?: string;
  },
  io: GrantedReadIo,
): Promise<GrantedReadResult> {
  // 1. Resolve — is this a live cross-tenant grant, and on which owner DB?
  //    Every negative answer fails closed before any owner DB is touched.
  const resolved = await resolveGrantedRead({
    buyerTenantId: input.buyerTenantId,
    requestedDbId: input.requestedDbId,
    resolveActiveGrant: io.resolveActiveGrant,
    resolveOwnerDb: io.resolveOwnerDb,
  });
  if (!resolved.ok) return resolved;

  // 2. Plan — compose the box-2 guardrails (scope at validation, non-owner
  //    role, owner-scoped RLS GUCs, in-flight revocation bound). A scope reject
  //    short-circuits before any statement runs.
  const plan = await planGrantedRead({
    grant: resolved.grant,
    rawSql: input.rawSql,
    schemaName: resolved.schemaName,
  });
  if (!plan.ok) return plan;

  // 3. Execute on the OWNER's DB. A throw propagates — nothing is metered
  //    (SK-EKP-008: only a successfully-executed query bills).
  const result = await io.runExecSteps(resolved.ownerDb, plan.execSteps);

  // 4. Meter, only now that the read returned. Synthesize + persist an
  //    idempotency key when the client omitted one so this record — and the fee
  //    event later keyed on it — is idempotent under retry.
  const idempotencyKey = input.idempotencyKey ?? io.newIdempotencyKey();
  const usage = await io.recordUsage({
    grantId: resolved.grant.id,
    ownerTenantId: resolved.grant.ownerTenantId,
    ownerDbId: resolved.grant.ownerDbId,
    granteeTenantId: resolved.grant.granteeTenantId,
    idempotencyKey,
  });

  return {
    ok: true,
    rows: result.rows,
    rowCount: result.rowCount,
    grant: resolved.grant,
    tables: plan.tables,
    idempotencyKey,
    usageRecorded: usage.recorded,
  };
}
