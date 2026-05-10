// Merged `/v1/ask` classifier (SK-ASK-009). Replaces the older
// `classifyKind` + `disambiguateDb` pair with a single cheap-tier
// LLM call that consumes the principal's recent-tables MRU plus the
// dbset and returns `{kind, targetDbId, referencedTables, ...}`.
//
// The load-bearing case is "insert red and blue tables" — without
// table-level context, classify picks `kind=destructive` (it sees
// SQL `INSERT`) and the planner emits `INSERT INTO red ...` against
// non-existent tables. With `recentTables` in context, `red`/`blue`
// don't appear in any MRU, the LLM applies the prompt rule
// "unknown table → create", and the request routes to the typed-plan
// pipeline instead.
//
// Routing order (first match wins, except slug fast-path which only
// short-circuits dbId resolution):
//   1. 0 dbs                       → kind=create, no LLM.
//   2. recent-table substring hit  → kind from verb keywords, no LLM.
//   3. slug substring hit          → targetDbId pinned; LLM still
//                                    decides kind (confidence 1).
//   4. LLM `route` call            → confidence ≥ ROUTE_CONFIDENCE_FLOOR
//                                    or 409 candidate_dbs at the
//                                    handler.

import type { RouteResponse as LLMRouteResponse, LLMRouter, RouteRecentTable } from "@nlqdb/llm";
import type { RecentTable } from "./recent-tables.ts";

export type DbCandidate = { id: string; slug: string };

export type RouteAskInput = {
  goal: string;
  dbs: DbCandidate[];
  recentTables: RecentTable[];
};

export type RouteAskKind = "create" | "query" | "write";
export type RouteAskReason =
  | "no_dbs"
  | "recent_table_match"
  | "slug_match"
  | "llm"
  | "llm_picked_unknown_id";

export type RouteAskOutput = {
  kind: RouteAskKind;
  // null when kind === "create" or the LLM returns null.
  targetDbId: string | null;
  // empty when kind === "create".
  referencedTables: string[];
  confidence: number;
  reason: RouteAskReason;
};

export type RouteAskDeps = {
  llm: LLMRouter;
};

// Mirrors the floor today's disambiguator enforced. Below this the
// route handler returns `409 candidate_dbs`.
export const ROUTE_CONFIDENCE_FLOOR = 0.7;

// Verb shortlist that decides query-vs-write when a recent-table hits
// without an LLM call. `add` and `remove` are common write synonyms
// power users reach for; `show` / `count` / `list` / `describe` /
// `what` / `how` / `which` cover the read shapes. Anything else is
// ambiguous and falls through to the LLM.
const WRITE_VERBS = ["insert", "update", "delete", "add", "remove"] as const;
const QUERY_VERBS = ["show", "count", "list", "describe", "what", "how", "which"] as const;

// Words shorter than this are too generic to anchor a slug match
// (e.g. "db", "id", "x"). Avoids matching "id" in "send a slack message".
// Same threshold today's disambiguateDb uses.
const SLUG_WORD_MIN_LEN = 4;

export async function routeAsk(deps: RouteAskDeps, input: RouteAskInput): Promise<RouteAskOutput> {
  // 1. 0 dbs → deterministic create.
  if (input.dbs.length === 0) {
    return {
      kind: "create",
      targetDbId: null,
      referencedTables: [],
      confidence: 1,
      reason: "no_dbs",
    };
  }

  // 2. Recent-table substring fast-path. Word-boundary case-insensitive.
  // The first table whose name appears in the goal wins; verb keywords
  // pin the kind. Ambiguous verb → fall through to slug/LLM (we have
  // table evidence but not enough to decide read vs write).
  const tableHit = matchRecentTable(input.goal, input.recentTables);
  if (tableHit) {
    const verbKind = pickVerbKind(input.goal);
    if (verbKind) {
      return {
        kind: verbKind,
        targetDbId: tableHit.dbId,
        referencedTables: [tableHit.table],
        confidence: 1,
        reason: "recent_table_match",
      };
    }
  }

  // 3. Slug substring fast-path. Picks targetDbId deterministically;
  // we still consult the LLM for kind because slug alone doesn't
  // disambiguate read vs write.
  const slugMatchedDbId = matchBySlug(input.goal, input.dbs);

  // 4. LLM call. Errors propagate — the route handler maps them to 502.
  const llmOut: LLMRouteResponse = await deps.llm.route({
    goal: input.goal,
    dbs: input.dbs,
    recentTables: toLLMRecentTables(input.recentTables),
  });

  // Validate the LLM's pick: hallucinated dbId → null pick so the
  // handler returns 409 rather than a wrong-tenant target.
  const llmDbIdValid =
    llmOut.targetDbId === null || input.dbs.some((d) => d.id === llmOut.targetDbId);
  const validatedDbId = llmDbIdValid ? llmOut.targetDbId : null;
  const referencedTables = Array.isArray(llmOut.referencedTables) ? llmOut.referencedTables : [];

  // If the slug fast-path matched, override the LLM's dbId pick with
  // the deterministic slug match (confidence 1, reason "slug_match").
  // Kind / referencedTables still come from the LLM.
  if (slugMatchedDbId !== null && llmOut.kind !== "create") {
    return {
      kind: llmOut.kind,
      targetDbId: slugMatchedDbId,
      referencedTables,
      confidence: 1,
      reason: "slug_match",
    };
  }

  return {
    kind: llmOut.kind,
    targetDbId: validatedDbId,
    referencedTables: llmOut.kind === "create" ? [] : referencedTables,
    confidence: llmOut.confidence,
    reason: llmDbIdValid ? "llm" : "llm_picked_unknown_id",
  };
}

function matchRecentTable(
  goal: string,
  recent: RecentTable[],
): { dbId: string; table: string } | null {
  const haystack = goal.toLowerCase();
  for (const t of recent) {
    const needle = t.table.toLowerCase();
    if (!needle) continue;
    // Word-boundary match — `\b` is safe for ASCII identifiers, which
    // is what Postgres tables (and our identifier whitelist) accept.
    const pattern = new RegExp(`\\b${escapeRegex(needle)}\\b`);
    if (pattern.test(haystack)) {
      return { dbId: t.dbId, table: t.table };
    }
  }
  return null;
}

function pickVerbKind(goal: string): RouteAskKind | null {
  const haystack = goal.toLowerCase();
  for (const v of WRITE_VERBS) {
    if (new RegExp(`\\b${v}\\b`).test(haystack)) return "write";
  }
  for (const v of QUERY_VERBS) {
    if (new RegExp(`\\b${v}\\b`).test(haystack)) return "query";
  }
  return null;
}

// Slug-words appearing in the goal. Words are kebab-segments of the
// slug (e.g. `orders-tracker-a4f` → `orders`, `tracker`); the random
// 6-char tail is filtered out by the SLUG_WORD_MIN_LEN gate plus the
// "must contain a vowel" check (random base36 tails like `a4fxyz`
// rarely match this). Returns the matched dbId only when exactly one
// candidate hits — multiple hits are ambiguous.
function matchBySlug(goal: string, candidates: DbCandidate[]): string | null {
  const haystack = goal.toLowerCase();
  const matches: string[] = [];
  for (const c of candidates) {
    const words = c.slug
      .toLowerCase()
      .split(/[-_]/)
      .filter((w) => w.length >= SLUG_WORD_MIN_LEN && /[aeiou]/.test(w));
    if (words.some((w) => haystack.includes(w))) matches.push(c.id);
  }
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function toLLMRecentTables(recent: RecentTable[]): RouteRecentTable[] {
  return recent.map((t) => ({ dbId: t.dbId, table: t.table }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
