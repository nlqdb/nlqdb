// Shared dbId minting used by every connect path (paste `connectByoDb` and the
// OAuth Management-API `connectSupabaseMgmt`), so the `db_<slug>_<6char>` id
// shape and the collision-retry can never drift between them (`GLOBAL-017`).

// Normalise an arbitrary name into a safe slug body for the dbId
// (`db_<slug>_<suffix>`). Lowercase, `[a-z0-9_]` only, collapse runs of
// `_`, trim leading/trailing `_`. Falls back to "byo" when the input
// reduces to nothing (e.g. a name of only punctuation).
export function makeSlug(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "byo";
}

// Mint `db_<slug>_<suffix>` and confirm it's free in D1. Re-mints the
// suffix on a true collision (bounded to 3 attempts so a misconfigured
// suffix generator can't loop forever). Returns null if all attempts
// collide. The id format matches the create path's `db_<slug>_<6char>`,
// so `deriveSlug` / `displayName` in databases/list.ts render it cleanly.
export async function mintUniqueDbId(
  d1: D1Database,
  slug: string,
  randomSuffix: () => string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const dbId = `db_${slug}_${randomSuffix()}`;
    const existing = await d1
      .prepare("SELECT id FROM databases WHERE id = ?")
      .bind(dbId)
      .first<{ id: string }>();
    if (!existing) return dbId;
  }
  return null;
}
