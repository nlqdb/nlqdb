// The two verbs (`GLOBAL-043` item 5): `apply` and `reject` on one proposal
// the attach door recorded. Each records who decided and when on the proposal's
// ledger row; a reject also records the reason given. Every door (API, CLI,
// MCP, web) calls this one function.
//
// A verb flips the row out of `proposed` with a compare-and-set before it
// touches the user's DB, so two concurrent applies run the DDL once. A failed
// apply puts the row back to `proposed`: `applyProposal` has already tried to
// clear any half-built index (a dropped socket can leave one behind).
// Repeating the verb that decided a row returns that row (`SK-IDEMP-004`); the
// other verb is refused.
//
// An apply also keeps its fingerprint's cumulative counters (`verify_from`);
// `verifyDue` (the `dba_verify` job) diffs them against a fresh read once the
// window has passed — the p95 re-read and auto-revert, `verifyApplied`.

import {
  applyProposal,
  judgeApplied,
  type PostgresQueryFn,
  type Proposal,
  type StatementCounters,
  snapshotPostgresStatements,
  statementWindow,
  type Verification,
  validateByoConnection,
  verifyApplied,
  withDbaSpan,
} from "@nlqdb/db";
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
  | { ok: false; code: "proposal_decided"; status: "applied" | "rejected" | "reverted" };

// `SK-HDC-010`'s bound for index DDL; `CONCURRENTLY` can't run in a
// transaction, so it is set on the session before the build.
const INDEX_DDL_TIMEOUT = "SET statement_timeout = '600s'";

type Row = {
  id: number;
  dbId: string;
  status: "proposed" | "applied" | "rejected" | "reverted";
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
  if (args.verb === "apply") await validate(row.id, proposal);

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
      status: now?.status === "applied" || now?.status === "reverted" ? now.status : "rejected",
    };
  }

  if (args.verb === "apply") {
    let from: StatementCounters | null;
    try {
      from = await applyOn(deps, row, proposal);
    } catch (cause) {
      await deps.d1
        .prepare(
          "UPDATE dba_changes SET status = 'proposed', decided_by = NULL, decided_at = NULL WHERE id = ? AND status = 'applied'",
        )
        .bind(args.id)
        .run();
      return { ok: false, code: "apply_failed", cause };
    }
    // After the catch: the index is built, so a D1 blip here must not return
    // the row to `proposed`. Without it, verify judges the row unmeasured.
    if (from) {
      await deps.d1
        .prepare("UPDATE dba_changes SET verify_from = ? WHERE id = ?")
        .bind(JSON.stringify(from), args.id)
        .run()
        .catch(() => {});
    }
  }
  const now = await readRow(deps.d1, args.id, args.tenantId);
  return now
    ? { ok: true, proposal: decided(now), replayed: false }
    : { ok: false, code: "proposal_not_found" };
}

// `GLOBAL-043` item 7: only a proposal kind's own verbs run under the owner role.
async function validate(id: number, proposal: Proposal): Promise<void> {
  const { validateProposalDdl } = await import("./ask/sql-validate-ddl.ts");
  const v = validateProposalDdl(proposal);
  if (!v.ok) throw new Error(`proposal ${id} failed the DDL validator: ${v.reason}`);
}

// Opens the sealed URL, re-guards its host (`GLOBAL-035`, DNS may have moved
// since attach) and hands `fn` a socket closed in `finally`.
async function onAttached<T>(
  deps: DecideDeps,
  row: { dbId: string; blob: string | null },
  fn: (query: PostgresQueryFn) => Promise<T>,
): Promise<T> {
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
    return await fn(conn.query);
  } finally {
    await conn.close();
  }
}

// Runs the proposal's DDL, then reads its fingerprint's counters — the start
// of the verify window. Null when it names no fingerprint (catalog tier) or
// `pg_stat_statements` can't be read: the apply stands, verify says unmeasured.
function applyOn(
  deps: DecideDeps,
  row: Row,
  proposal: Proposal,
): Promise<StatementCounters | null> {
  return onAttached(deps, row, async (query) => {
    await applyProposal(query, proposal);
    const fingerprint = proposal.evidence.workload?.fingerprint;
    if (!fingerprint) return null;
    const snapshot = await readCounters(query, proposal.schema).catch(() => null);
    if (!snapshot) return null;
    // Not run since the last stats reset: the window counts from zero.
    return snapshot.get(fingerprint) ?? { query: "", calls: 0, totalMs: 0, sumSquaresMs: 0 };
  });
}

// `GLOBAL-043` item 7: 72 h on both engines until the spike measures when each
// engine's counters settle.
export const VERIFY_WINDOW_SEC = 72 * 3600;
// Rows per tick: each opens a socket to a user's DB (Workers' subrequest cap).
const VERIFY_BATCH = 5;

type DueRow = {
  id: number;
  dbId: string;
  proposal: string;
  verifyFrom: string | null;
  blob: string | null;
};

// Judges each applied proposal whose window has passed and records the
// verdict; a regression has already been reverted by `verifyApplied` when its
// row turns `reverted`. A row whose DB can't be reached stays due for the next
// tick; the error is logged, the rest of the batch still runs.
export async function verifyDue(
  deps: DecideDeps,
  nowSec: number,
): Promise<{ id: number; verification: Verification }[]> {
  const { results } = await deps.d1
    .prepare(
      "SELECT c.id, c.database_id AS dbId, c.proposal, c.verify_from AS verifyFrom, d.connection_blob AS blob FROM dba_changes c JOIN databases d ON d.id = c.database_id WHERE c.status = 'applied' AND c.proposal IS NOT NULL AND c.verified_at IS NULL AND c.decided_at <= ? ORDER BY c.decided_at LIMIT ?",
    )
    .bind(nowSec - VERIFY_WINDOW_SEC, VERIFY_BATCH)
    .all<DueRow>();
  const verified: { id: number; verification: Verification }[] = [];
  for (const row of results) {
    try {
      const verification = await verifyRow(deps, row);
      await deps.d1
        .prepare(
          "UPDATE dba_changes SET verification = ?, verified_at = unixepoch(), status = ? WHERE id = ? AND verified_at IS NULL",
        )
        .bind(
          JSON.stringify(verification),
          verification.verdict === "revert" ? "reverted" : "applied",
          row.id,
        )
        .run();
      verified.push({ id: row.id, verification });
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "dba_verify_failed",
          id: row.id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
  return verified;
}

async function verifyRow(deps: DecideDeps, row: DueRow): Promise<Verification> {
  const proposal = JSON.parse(row.proposal) as Proposal;
  const fingerprint = proposal.evidence.workload?.fingerprint;
  if (!fingerprint) return judgeApplied(proposal, []);
  if (!row.verifyFrom) {
    return { verdict: "unmeasured", reason: "no counters kept at apply" };
  }
  if (!deps.kek) throw new Error("sealing unconfigured");
  await validate(row.id, proposal);
  const from = JSON.parse(row.verifyFrom) as StatementCounters;
  return onAttached(deps, row, async (query) => {
    const window = statementWindow(
      new Map([[fingerprint, from]]),
      await readCounters(query, proposal.schema),
    );
    return verifyApplied(query, proposal, window);
  });
}

// The fingerprint counters read that opens and closes a verify window, under
// the loop's span (`GLOBAL-014`).
const readCounters = (query: PostgresQueryFn, schema: string) =>
  withDbaSpan("db.observe", "snapshot_statements", schema, () => snapshotPostgresStatements(query));
