// Apply on an attached D1 (`GLOBAL-043` items 4 and 7) — the D1 twin of
// `applyProposal`. The DDL rides one REST request, and D1 runs a request's
// statements as one transaction, so a failed build leaves nothing behind and
// no inverse runs (Postgres's half-built `CONCURRENTLY` index has no D1 twin).
// `PRAGMA optimize` rides the same request so the planner has stats for the
// new index (`002-rateme12-attach.md` §2).
//
// The D1 validator is a re-render: a ledger row runs only when its DDL and
// inverse are exactly what `createD1IndexProposal` makes of its own (table,
// columns), on a table that is not SQLite's or D1's own. libpg_query, the
// Postgres validator, can't parse SQLite, and the row needs no parser — it
// can only ever be the one statement nlqdb renders.

import type { D1BatchFn, D1QueryInsight } from "./d1/rest.ts";
import { type D1Verification, REGRESSION_BOUND } from "./dba-apply-postgres.ts";
import { createD1IndexProposal, type Proposal } from "./dba-proposal.ts";
import { withDbaSpan } from "./dba-span.ts";

export function isD1ProposalDdl(p: Proposal): boolean {
  if (p.kind !== "create_index" || p.schema !== "main" || p.columns.length === 0) return false;
  if (/^(sqlite_|_cf_)/i.test(p.table)) return false;
  const want = createD1IndexProposal(p);
  return p.ddl === want.ddl && p.inverse === want.inverse;
}

export function applyD1Proposal(batch: D1BatchFn, proposal: Proposal): Promise<void> {
  return withDbaSpan(
    "db.apply",
    `apply_${proposal.kind}`,
    proposal.schema,
    async () => {
      await batch([proposal.ddl, "PRAGMA optimize"]);
    },
    "sqlite",
  );
}

// Pure: the verdict for an applied D1 proposal over the query insights after
// its apply. D1 keeps no percentile, so its mean time stands in for p95; rows
// read per run is what D1 bills, so an index that reads more is a regression
// too. Either > 10 % worse reverts.
export function judgeD1Applied(proposal: Proposal, after: D1QueryInsight[]): D1Verification {
  const target = proposal.evidence.d1Workload;
  if (!target) return { verdict: "unmeasured", reason: "no query text (catalog tier)" };
  const now = after.find((i) => i.query === target.query);
  if (!now) return { verdict: "unmeasured", reason: "query did not run in the window" };
  const worse =
    now.meanMs > target.meanMs * REGRESSION_BOUND ||
    now.rowsRead > target.rowsRead * REGRESSION_BOUND;
  return {
    verdict: worse ? "revert" : "keep",
    query: target.query,
    beforeMeanMs: target.meanMs,
    afterMeanMs: now.meanMs,
    beforeRowsRead: target.rowsRead,
    afterRowsRead: now.rowsRead,
  };
}

// The D1 twin of `verifyApplied`: judges, and on a regression runs the stored
// inverse before returning, so no caller can skip the revert.
export function verifyD1Applied(
  batch: D1BatchFn,
  proposal: Proposal,
  after: D1QueryInsight[],
): Promise<D1Verification> {
  return withDbaSpan(
    "db.verify",
    `verify_${proposal.kind}`,
    proposal.schema,
    async (span) => {
      const v = judgeD1Applied(proposal, after);
      span.setAttribute("nlqdb.dba.verdict", v.verdict);
      if (v.verdict === "revert") await batch([proposal.inverse]);
      return v;
    },
    "sqlite",
  );
}
