// Render-time prettifier for LLM-emitted snake_case / kebab-case
// identifiers (table column names, table names) so result tables
// don't show `customer_id` raw. Sentence-case rather than full
// title-case to keep acronyms (`id`, `url`) reading correctly.
//
// English-only word splitting — i18n is a future concern. Anything
// without `_` or `-` is treated as already-pretty and returned
// verbatim, so the helper is idempotent on its own output.

export function prettifyHeader(identifier: string): string {
  if (!/[_-]/.test(identifier)) return identifier;
  const replaced = identifier.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (replaced.length === 0) return identifier;
  return replaced.charAt(0).toUpperCase() + replaced.slice(1);
}

// Render one result/sample cell to a display string. Shared by the
// chat result table (Data.tsx) and the create-path sample table
// (SampleTable.tsx) so a stranger sees the SAME rendering of the same
// value on either "did it work?" surface. The object fallback is
// load-bearing: a JSON/JSONB column value arrives as an object, and a
// bare `String(value)` would show `[object Object]` in the create
// surface — the divergence this single source of truth removes.
// `null`/`undefined` are caught first, so JSON.stringify never sees
// `undefined` (which would yield the value `undefined`, not a string).
export function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
