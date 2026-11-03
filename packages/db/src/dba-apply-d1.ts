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

import type { D1BatchFn } from "./d1/rest.ts";
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
