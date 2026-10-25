// The DBA loop's one object (`GLOBAL-043` item 4): a proposed change with its
// DDL, its stored inverse and the evidence that produced it. Engine-agnostic —
// a Postgres or D1 observer emits the same shape, and apply / verify / revert
// (later item-1a slices) consume it without knowing which observer made it.
// `kind` is the discriminant of one union (`SK-MIGRATE-003`); adding a kind is
// a union member, a compiler arm and an inverse — nothing else.
// `createIndexProposal` renders Postgres DDL; the D1 slice adds its own.

import { quoteIdent } from "./render-byo-postgres.ts";

export type CreateIndexProposal = {
  kind: "create_index";
  // Data tier the proposal came from (`GLOBAL-043` item 7): 0 = catalog only.
  tier: 0 | 1 | 2;
  schema: string;
  table: string;
  columns: string[];
  ddl: string;
  inverse: string;
  // One sentence a user can read on the proposal card.
  reason: string;
  // What the observer saw — the card's cost line (`END_GOAL.md` row 3).
  evidence: { rowEstimate: number; tableBytes: number };
};

export type Proposal = CreateIndexProposal;

// Postgres index names share one namespace per schema and truncate past 63
// bytes. The name is `nlqdb_` (out of the app's own naming), a readable
// table/columns stem cut to fit, and a hash of the exact (table, columns): the
// stem alone is ambiguous (`a_b(c)` and `a(b_c)` both read `nlqdb_a_b_c`).
const PG_MAX_IDENT_BYTES = 63;

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function indexName(table: string, columns: string[]): string {
  const stem = new TextEncoder().encode(`nlqdb_${table}_${columns.join("_")}`);
  // stem + "_" + 8 hex <= 63 bytes. Decode drops a split multibyte tail.
  const head = new TextDecoder()
    .decode(stem.slice(0, PG_MAX_IDENT_BYTES - 9))
    .replace(/\uFFFD$/, "");
  return `${head}_${fnv1a(JSON.stringify([table, ...columns]))}`;
}

// `CONCURRENTLY` so the build never blocks the app's writes (`GLOBAL-043`).
// No `IF NOT EXISTS` on the build: a taken name fails loud (42P07) instead of
// a silent no-op whose inverse would drop an index this apply never made. A
// failed `CONCURRENTLY` build leaves an invalid index under this proposal's
// own name; its inverse clears it before a retry. `IF EXISTS` keeps a retried
// undo a no-op.
export function createIndexProposal(
  p: Omit<CreateIndexProposal, "kind" | "ddl" | "inverse">,
): CreateIndexProposal {
  const name = indexName(p.table, p.columns);
  const cols = p.columns.map(quoteIdent).join(", ");
  return {
    kind: "create_index",
    ...p,
    ddl: `CREATE INDEX CONCURRENTLY ${quoteIdent(name)} ON ${quoteIdent(p.schema)}.${quoteIdent(p.table)} (${cols})`,
    inverse: `DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(p.schema)}.${quoteIdent(name)}`,
  };
}
