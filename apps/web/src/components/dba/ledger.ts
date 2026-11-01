// Pure helpers for `/app/dba` — kept out of the island so they test
// without a DOM.

import { type DatabaseSummary, type DbaChange, type NlqClient, NlqdbApiError } from "@nlqdb/sdk";

// `?db=<id or slug>` picks the DB; else the most recently queried one.
export function pickDb(dbs: DatabaseSummary[], param: string | null): DatabaseSummary | null {
  if (param) {
    const hit = dbs.find((d) => d.id === param || d.slug === param);
    if (hit) return hit;
  }
  return [...dbs].sort((a, b) => (b.lastQueriedAt ?? 0) - (a.lastQueriedAt ?? 0))[0] ?? null;
}

// One line a person reads before the DDL: what changed, and what wrote it —
// or, for a proposal on an attached DB, that nothing has changed yet and why.
export function describeChange(
  c: Pick<DbaChange, "kind" | "table" | "origin" | "status" | "reason" | "verification">,
): string {
  if (c.status === "proposed") return `Proposed, not applied — ${c.reason ?? c.table}`;
  if (c.status === "rejected") return `Rejected, not applied — ${c.reason ?? c.table}`;
  const v = c.verification;
  if (v && v.verdict !== "unmeasured") {
    const p95 = `p95 est. ${ms(v.beforeP95Ms)} → ${ms(v.afterP95Ms)}`;
    return v.verdict === "revert"
      ? `Reverted: its query ran slower (${p95}) — ${c.reason ?? c.table}`
      : `Applied and verified: ${p95} — ${c.reason ?? c.table}`;
  }
  const what =
    c.kind === "create_table"
      ? `Created table ${c.table}`
      : c.kind === "add_column"
        ? `Added a column to ${c.table}`
        : `Indexed a key on ${c.table}`;
  const from =
    c.origin === "insert" ? "insert()" : c.origin === "ask" ? "a chat write" : "an attach proposal";
  return `${what} — from ${from}`;
}

const ms = (n: number) => `${n < 10 ? n.toFixed(2) : n.toFixed(0)} ms`;

// The web door's two verbs (`GLOBAL-043` item 5): one click on a proposal
// calls `POST /v1/proposals/:id/apply|reject` as the cookie session, so the
// ledger names the person (`user:<id>`). The outcome is the row's new status,
// or one sentence the row shows in place — never a silent failure.
export type Verb = "apply" | "reject";
export type Decision =
  | { ok: true; status: DbaChange["status"]; note?: string }
  | { ok: false; message: string };

export async function decide(
  client: Pick<NlqClient, "applyProposal" | "rejectProposal">,
  id: number,
  verb: Verb,
  reason?: string,
): Promise<Decision> {
  try {
    const trimmed = reason?.trim();
    const { proposal } =
      verb === "apply"
        ? await client.applyProposal(id)
        : await client.rejectProposal(id, trimmed ? { reason: trimmed } : {});
    return { ok: true, status: proposal.status };
  } catch (err) {
    // The API's copy is already one safe sentence (`GLOBAL-012`).
    if (err instanceof NlqdbApiError) {
      if (err.httpStatus === 401) return { ok: false, message: "Sign in again to decide." };
      // Decided elsewhere (another tab, the CLI, an agent): the row moves to its real status.
      const status = err.body?.params?.status;
      if (err.code === "proposal_decided" && isDecided(status)) {
        return { ok: true, status, note: err.body?.message ?? `Already ${status}.` };
      }
      return { ok: false, message: err.body?.message ?? "Couldn't decide that one — try again." };
    }
    return { ok: false, message: "Couldn't reach the API — try again." };
  }
}

const isDecided = (s: unknown): s is DbaChange["status"] =>
  s === "applied" || s === "rejected" || s === "reverted";

// The ledger after a decision: only that row's status moves.
export function withStatus(
  changes: DbaChange[],
  id: number,
  status: DbaChange["status"],
): DbaChange[] {
  return changes.map((c) => (c.id === id ? { ...c, status } : c));
}
