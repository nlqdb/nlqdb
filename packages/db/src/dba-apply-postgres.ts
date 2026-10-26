// Apply → verify → auto-revert for an attached Postgres (`GLOBAL-043` items 4
// and 7, Tier 3): the loop's last three steps on one proposal. The caller
// (the doors, a later item-1a slice) records the outcome in the ledger.
//
// Verify re-reads the proposal's own fingerprint over a window after the
// apply and compares its p95 estimate with the one the proposal was made on.
// More than 10 % worse reverts — always, whoever approved the apply; the
// inverse is the one stored on the proposal, never re-derived.

import { withDbaSpan } from "./dba-observe-postgres.ts";
import type { FingerprintWindow } from "./dba-observe-postgres-workload.ts";
import type { Proposal } from "./dba-proposal.ts";
import type { PostgresQueryFn } from "./postgres.ts";

// `GLOBAL-043` item 7's regression bound (after > before × 1.1 reverts).
const REGRESSION_BOUND = 1.1;

export type Verification =
  | { verdict: "keep" | "revert"; fingerprint: string; beforeP95Ms: number; afterP95Ms: number }
  // Nothing to compare: a catalog-tier proposal names no fingerprint, or the
  // window never ran it. Kept, and claims no delta.
  | { verdict: "unmeasured"; reason: string };

// Pure: the verdict for an applied proposal over the window after its apply.
export function judgeApplied(proposal: Proposal, after: FingerprintWindow[]): Verification {
  const target = proposal.evidence.workload;
  if (!target) return { verdict: "unmeasured", reason: "no fingerprint (catalog tier)" };
  const now = after.find((w) => w.fingerprint === target.fingerprint);
  if (!now) return { verdict: "unmeasured", reason: "fingerprint did not run in the window" };
  return {
    verdict: now.p95EstimateMs > target.p95EstimateMs * REGRESSION_BOUND ? "revert" : "keep",
    fingerprint: target.fingerprint,
    beforeP95Ms: target.p95EstimateMs,
    afterP95Ms: now.p95EstimateMs,
  };
}

// Runs the proposal's DDL. A failed `CONCURRENTLY` build leaves an invalid
// index under the proposal's name, so its inverse clears it before the error
// is rethrown — except when the name was already taken (42P07): that index
// isn't this apply's to drop.
export function applyProposal(query: PostgresQueryFn, proposal: Proposal): Promise<void> {
  return withDbaSpan("db.apply", proposal.kind, proposal.schema, async () => {
    try {
      await query(proposal.ddl, []);
    } catch (err) {
      if ((err as { code?: unknown }).code !== "42P07") await query(proposal.inverse, []);
      throw err;
    }
  });
}

// Judges an applied proposal and, on a regression, runs its inverse before
// returning — the revert is part of verify, so no caller can skip it.
export function verifyApplied(
  query: PostgresQueryFn,
  proposal: Proposal,
  after: FingerprintWindow[],
): Promise<Verification> {
  return withDbaSpan("db.verify", proposal.kind, proposal.schema, async (span) => {
    const v = judgeApplied(proposal, after);
    span.setAttribute("nlqdb.dba.verdict", v.verdict);
    if (v.verdict === "revert") await query(proposal.inverse, []);
    return v;
  });
}
