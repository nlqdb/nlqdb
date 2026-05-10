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
