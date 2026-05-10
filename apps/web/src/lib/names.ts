// Mirrors `apps/api/src/databases/list.ts`'s `deriveSlug` and
// `displayName` so optimistic surfaces (post-create rail inserts,
// pre-fetch placeholders) can render the same names the API would
// have returned. Server is still authoritative — when the next
// list-databases response lands, the rail re-renders with the
// API-supplied fields verbatim.

// `db_orders_tracker_a4fxyz` → `orders-tracker-a4fxyz`. Used as the
// URL-safe / technical form (rail hover-title, copy-snippet output).
export function deriveSlug(dbId: string): string {
  const stripped = dbId.startsWith("db_") ? dbId.slice(3) : dbId;
  return stripped.replace(/_/g, "-");
}

// `db_orders_tracker_a4fxyz` → `orders tracker`. Strips the `db_`
// prefix and the trailing `_<6 lowercase alnum>` random suffix the
// orchestrator mints. Surfaces render this for headers / rail items.
export function displayName(dbId: string): string {
  if (!dbId.startsWith("db_")) return dbId.replace(/_/g, " ");
  const stripped = dbId.slice(3);
  if (/^[a-z0-9]{6}$/.test(stripped)) return stripped;
  return stripped.replace(/_[a-z0-9]{6}$/, "").replace(/_/g, " ");
}
