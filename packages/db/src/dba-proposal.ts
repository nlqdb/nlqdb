// The DBA loop's one object (`GLOBAL-043` item 4): a proposed change with its
// DDL, its stored inverse and the evidence that produced it. Engine-agnostic —
// a Postgres or D1 observer emits the same shape, and apply / verify / revert
// (later item-1a slices) consume it without knowing which observer made it.
// `kind` is the discriminant of one union (`SK-MIGRATE-003`); adding a kind is
// a union member, a compiler arm and an inverse — nothing else.

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

// Postgres truncates identifiers past 63 bytes, so two long names could
// collide silently; past the limit keep a prefix and a hash of the full name.
const PG_MAX_IDENT_BYTES = 63;

// Double-quote an identifier, escaping embedded quotes (same rule as
// `render-byo-postgres.ts`).
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function indexName(table: string, columns: string[]): string {
  const full = `${table}_${columns.join("_")}_idx`;
  const bytes = new TextEncoder().encode(full);
  if (bytes.length <= PG_MAX_IDENT_BYTES) return full;
  // 54 bytes of prefix + "_" + 8 hex = 63. Decode drops a split multibyte tail.
  const prefix = new TextDecoder().decode(bytes.slice(0, 54)).replace(/�$/, "");
  return `${prefix}_${fnv1a(full)}`;
}

// `CONCURRENTLY` so the build never blocks the app's writes (`GLOBAL-043`);
// `IF [NOT] EXISTS` so a retried apply or undo is a no-op, not an error.
export function createIndexProposal(
  p: Omit<CreateIndexProposal, "kind" | "ddl" | "inverse">,
): CreateIndexProposal {
  const name = indexName(p.table, p.columns);
  const cols = p.columns.map(quoteIdent).join(", ");
  return {
    kind: "create_index",
    ...p,
    ddl: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(p.schema)}.${quoteIdent(p.table)} (${cols})`,
    inverse: `DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(p.schema)}.${quoteIdent(name)}`,
  };
}
