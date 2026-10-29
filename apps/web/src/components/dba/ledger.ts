// Pure helpers for `/app/dba` v0 — kept out of the island so they test
// without a DOM.

import type { DatabaseSummary, DbaChange } from "@nlqdb/sdk";

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
