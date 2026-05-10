// Pure trigger predicate for SK-ASK-011 (speculative create on
// probable-0-dbs). Returns `true` when the cached signals suggest the
// principal has 0 dbs and the goal is plausibly a create.
//
// Defensive false-positives are fine — the speculative create
// reconciler will roll back if D1 contradicts the cache. False
// negatives lose the cold-start parallelism win, so the predicate is
// permissive: when there's no slug-substring hint pointing at an
// existing db, we speculate.
//
// Soft-dep stub: WS1 (`recent-tables`) ships the `RecentTable[]`
// shape consumed here. Until WS1 lands the route handler always
// passes `[]`, which degrades the predicate to "always speculate
// when no slug hint" — slightly more rollback churn until the cache
// is wired, no behavioural break.

// Inline type, kept tiny so this file isn't blocked on WS1 merging.
// When `recent-tables.ts` lands it should re-export this same shape
// (or this file will switch to importing it).
export type RecentTable = {
  table: string;
  // Optional slug of the db the table lives in — used by the
  // slug-hint check below when WS1 populates it. Today (no WS1) the
  // predicate runs against an empty list so the field is unused.
  dbSlug?: string;
};

// Words shorter than this are too generic to anchor a slug match
// — mirrors `disambiguate-db.ts:SLUG_WORD_MIN_LEN`.
const SLUG_WORD_MIN_LEN = 4;

export function probablyZeroDbs(recentTables: RecentTable[], goal: string): boolean {
  if (recentTables.length > 0) return false;

  // No recent-table signal. Now check whether the goal contains a
  // slug-substring hint — if it does, we'd rather let the
  // disambiguate path resolve than speculate against a db we
  // already know about.
  return !goalContainsSlugHint(recentTables, goal);
}

function goalContainsSlugHint(recentTables: RecentTable[], goal: string): boolean {
  const haystack = goal.toLowerCase();
  for (const t of recentTables) {
    const slug = t.dbSlug;
    if (!slug) continue;
    const words = slug
      .toLowerCase()
      .split(/[-_]/)
      .filter((w) => w.length >= SLUG_WORD_MIN_LEN && /[aeiou]/.test(w));
    if (words.some((w) => haystack.includes(w))) return true;
  }
  return false;
}
