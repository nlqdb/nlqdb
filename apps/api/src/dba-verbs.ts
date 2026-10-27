// The two verbs (`GLOBAL-043` item 5): `apply` and `reject` on one proposal
// the attach door recorded. Each records who decided and when on the proposal's
// ledger row; a reject also records the reason given. Every door (API, CLI,
// MCP, web) calls this one function.
//
// A verb flips the row out of `proposed` with a compare-and-set before it
// touches the user's DB, so two concurrent applies run the DDL once. A failed
// apply puts the row back to `proposed`: `applyProposal` has already cleared
// any half-built index, so the DB is as it was. Repeating the verb that
// decided a row returns that row (`SK-IDEMP-004`); the other verb is refused.
//
// Verify (the p95 re-read and auto-revert, `verifyApplied`) runs after the
// 72 h window, not here.

import { applyProposal, type Proposal, validateByoConnection } from "@nlqdb/db";
import type { ConnectByoDeps } from "./db-connect/connect.ts";
import { openSecret } from "./secret-envelope.ts";

export type DecideDeps = Pick<ConnectByoDeps, "resolve" | "kek" | "d1" | "buildPostgresQuery">;

export type DecideArgs = { id: number; tenantId: string; decidedBy: string } & (
  | { verb: "apply" }
  | { verb: "reject"; reason: string | null }
);

export type DecidedProposal = {
  id: number;
  dbId: string;
  status: "applied" | "rejected";
  decidedBy: string;
  decidedAt: number;
  rejectReason: string | null;
};

export type DecideResult =
  | { ok: true; proposal: DecidedProposal; replayed: boolean }
  | { ok: false; code: "proposal_not_found" | "sealing_unconfigured" }
  | { ok: false; code: "apply_failed"; cause: unknown }
  | { ok: false; code: "proposal_decided"; status: "applied" | "rejected" };

// `SK-HDC-010`'s bound for index DDL; `CONCURRENTLY` can't run in a
// transaction, so it is set on the session before the build.
const INDEX_DDL_TIMEOUT = "SET statement_timeout = '600s'";

type Row = {
  id: number;
  dbId: string;
  status: "proposed" | "applied" | "rejected";
  proposal: string;
  blob: string | null;
  decidedBy: string | null;
  decidedAt: number | null;
  rejectReason: string | null;
};

function readRow(d1: D1Database, id: number, tenantId: string): Promise<Row | null> {
  return d1
    .prepare(
      "SELECT c.id, c.database_id AS dbId, c.status, c.proposal, d.connection_blob AS blob, c.decided_by AS decidedBy, c.decided_at AS decidedAt, c.reject_reason AS rejectReason FROM dba_changes c JOIN databases d ON d.id = c.database_id WHERE c.id = ? AND d.tenant_id = ? AND c.proposal IS NOT NULL",
    )
    .bind(id, tenantId)
    .first<Row>();
}

function decided(row: Row): DecidedProposal {
  return {
    id: row.id,
    dbId: row.dbId,
    status: row.status as DecidedProposal["status"],
    decidedBy: row.decidedBy ?? "",
    decidedAt: row.decidedAt ?? 0,
    rejectReason: row.rejectReason,
  };
}

export async function decideProposal(deps: DecideDeps, args: DecideArgs): Promise<DecideResult> {
  const row = await readRow(deps.d1, args.id, args.tenantId);
  if (!row) return { ok: false, code: "proposal_not_found" };
  const target = args.verb === "apply" ? "applied" : "rejected";
  if (row.status === target) return { ok: true, proposal: decided(row), replayed: true };
  if (row.status !== "proposed") return { ok: false, code: "proposal_decided", status: row.status };
  if (args.verb === "apply" && !deps.kek) return { ok: false, code: "sealing_unconfigured" };
  const proposal = JSON.parse(row.proposal) as Proposal;
  if (args.verb === "apply") {
    // `GLOBAL-043` item 7: only a proposal kind's own verbs run under the owner role.
    const { validateProposalDdl } = await import("./ask/sql-validate-ddl.ts");
    const v = validateProposalDdl(proposal);
    if (!v.ok) throw new Error(`proposal ${row.id} failed the DDL validator: ${v.reason}`);
  }

  const claim = await deps.d1
    .prepare(
      "UPDATE dba_changes SET status = ?, decided_by = ?, decided_at = unixepoch(), reject_reason = ? WHERE id = ? AND status = 'proposed'",
    )
    .bind(target, args.decidedBy, args.verb === "reject" ? args.reason : null, args.id)
    .run();
  if (!claim.meta.changes) {
    // Another call decided it between the read and the claim.
    const now = await readRow(deps.d1, args.id, args.tenantId);
    if (now?.status === target) return { ok: true, proposal: decided(now), replayed: true };
    return {
      ok: false,
      code: "proposal_decided",
      status: now?.status === "applied" ? "applied" : "rejected",
    };
  }

  if (args.verb === "apply") {
    try {
      await applyOn(deps, row, proposal);
    } catch (cause) {
      await deps.d1
        .prepare(
          "UPDATE dba_changes SET status = 'proposed', decided_by = NULL, decided_at = NULL WHERE id = ? AND status = 'applied'",
        )
        .bind(args.id)
        .run();
      return { ok: false, code: "apply_failed", cause };
    }
  }
  const now = await readRow(deps.d1, args.id, args.tenantId);
  return now
    ? { ok: true, proposal: decided(now), replayed: false }
    : { ok: false, code: "proposal_not_found" };
}

// Opens the sealed URL, re-guards its host (`GLOBAL-035`, DNS may have moved
// since attach) and runs the proposal's DDL on a socket closed in `finally`.
async function applyOn(deps: DecideDeps, row: Row, proposal: Proposal): Promise<void> {
  if (!row.blob) throw new Error("attached row has no connection_blob");
  const url = await openSecret(row.blob, {
    kek: deps.kek as string,
    context: `dbconn:${row.dbId}`,
  });
  const v = await validateByoConnection("postgres", url, deps.resolve);
  if (!v.ok) throw new Error(v.message);
  const conn = deps.buildPostgresQuery(url);
  try {
    await conn.query(INDEX_DDL_TIMEOUT, []);
    await applyProposal(conn.query, proposal);
  } finally {
    await conn.close();
  }
}
