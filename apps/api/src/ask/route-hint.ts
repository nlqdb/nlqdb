// Pure trigger predicate for SK-ASK-011 (speculative create on
// probable-0-dbs). Returns `true` when the cached signals suggest the
// principal has 0 dbs and the goal is plausibly a create.
//
// Defensive false-positives are fine — the speculative create
// reconciler will roll back if D1 contradicts the cache. False
// negatives lose the cold-start parallelism win, so the predicate is
// permissive: when there's no slug-substring hint pointing at an
// existing db, we speculate.

import type { RecentTable } from "./recent-tables.ts";

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
    const words = t.slug
      .toLowerCase()
      .split(/[-_]/)
      .filter((w) => w.length >= SLUG_WORD_MIN_LEN && /[aeiou]/.test(w));
    if (words.some((w) => haystack.includes(w))) return true;
  }
  return false;
}
