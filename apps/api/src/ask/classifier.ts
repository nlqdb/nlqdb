// Goal-kind classifier for the `/v1/ask` entrypoint. Decides
// `kind ∈ { "create", "query", "write" }` so the route handler can
// fan out: kind=create → typed-plan pipeline (apps/api/src/db-create/),
// kind=query/write → existing read/write orchestrator (./orchestrate.ts).
//
// Owners by skill: `.claude/skills/hosted-db-create/SKILL.md`
// SK-HDC-001 (one classifier-routed endpoint) and SK-ASK-001
// (`/v1/ask` is the single create-or-query endpoint).
//
// THIS IS A v0 HEURISTIC. SK-HDC-001 specifies a "cheap classifier-tier
// LLM call." That's the right long-term shape (trivial English ambiguity
// — "make me a leaderboard" — fools any keyword heuristic). The LLM
// version lands in a follow-up PR alongside a new `kind` field on the
// LLM router's classify operation. For now the heuristic ships so the
// kind=create branch can be exercised end-to-end; we document where the
// LLM swap-in goes (see `classifyKind` body) and the failure modes the
// heuristic accepts.
//
// Design choice: when a request supplies an explicit `dbId`, the
// classifier is NOT called — the dbId pins the target db, and the only
// open question is query-vs-write. That branch returns `kind: "query"`
// and lets the read/write orchestrator's existing intent classifier
// (LLMOperation `classify`) handle the destructive-vs-data triage. The
// new classifier here only runs on dbId-absent requests, which is the
// kind=create surface area — see SK-HDC-005 for why dbId resolution is
// deterministic-per-surface, not LLM-guess.

export type GoalKind = "create" | "query" | "write";

export type ClassifyKindResult = {
  kind: GoalKind;
  // 0..1 — heuristic emits 1.0 (deterministic match) or 0.5 (default
  // fallback). The LLM follow-up will surface real confidence.
  confidence: number;
  // Diagnostic label so the trace UI can render the heuristic's
  // reason without reading the rule body. Stable across LLM swap-in
  // (LLM version emits its rationale in the same shape).
  reason: string;
};

// Verbs / nouns that strongly imply the user wants a NEW database.
// Trimmed to high-precision tokens — overloaded ones (e.g. "log"
// is both verb-write and noun-create) are intentionally absent so
// the heuristic doesn't fire confidently on ambiguous goals. The
// LLM follow-up will handle the long tail.
//
// Token boundaries are word-anchored ("tracker" matches but not
// "racetrack"). Lowercased before match.
const CREATE_TOKENS = new Set([
  // Direct create verbs — "create me an X", "build a tracker"
  "create",
  "build",
  "make",
  "scaffold",
  // Setup phrasing — "set up a journal", "spin up a leaderboard"
  "setup",
  "spin",
  // Domain nouns that nearly always imply "I want a thing that
  // holds X". "log" is intentionally NOT here (overloaded with
  // verb-write usage); "memory" / "feedback" / "registry" same
  // story but rarer enough to keep.
  "tracker",
  "journal",
  "inventory",
  "leaderboard",
  "ledger",
  "directory",
  "catalog",
]);

// Verbs that imply mutation against an existing db (write goals).
// The destructive subset (DROP/TRUNCATE) is REJECTED upstream by
// sql-validate.ts (SK-ASK-004 + SK-SQLAL-*); heuristic leans toward
// "write" for the additive verbs so we route through the read/write
// orchestrator. "log" / "tag" are overloaded with read/noun usage
// and therefore omitted; the LLM follow-up will recover them.
const WRITE_TOKENS = new Set([
  "add",
  "insert",
  "record",
  "save",
  "delete",
  "remove",
  "refund",
  "promote",
  "update",
  "rename",
]);

// Tokens that imply a READ goal — high-precision read framings
// only. Common stopwords ("the", "last", "by", "over") are
// intentionally absent so they don't override write/create
// matches in mixed-token goals.
const READ_TOKENS = new Set([
  "show",
  "list",
  "find",
  "what",
  "how",
  "today",
  "yesterday",
  "average",
  "count",
  "total",
  "revenue",
]);

// Tokenises on word boundaries. Strips quotes / common English
// punctuation so "tracker." and "tracker" hit the same bucket.
// Runs once per goal — cheap; no regex backtracking on long inputs
// because the pattern is anchored.
function tokenize(goal: string): string[] {
  return goal.toLowerCase().match(/[a-z][a-z']+/g) ?? [];
}

/**
 * Classify a goal string into one of `create | query | write`.
 *
 * Called from `/v1/ask` only when `dbId` is absent. dbId-present
 * requests skip this entirely (see file header).
 *
 * Today this is a token-set heuristic. The LLM swap-in (cheap
 * classifier-tier call returning the same `ClassifyKindResult` shape)
 * is the follow-up PR; this function's signature stays stable so the
 * route handler doesn't change.
 */
export function classifyKind(goal: string): ClassifyKindResult {
  const tokens = tokenize(goal);
  if (tokens.length === 0) {
    // Empty goal — let the orchestrator surface a normal validation
    // error rather than guessing. Default to "query" so the
    // existing read/write orchestrator's parser gets first crack.
    return { kind: "query", confidence: 0.5, reason: "empty_goal_default" };
  }

  const seen = new Set(tokens);
  const matchedCreate = [...CREATE_TOKENS].filter((t) => seen.has(t));
  const matchedWrite = [...WRITE_TOKENS].filter((t) => seen.has(t));
  const matchedRead = [...READ_TOKENS].filter((t) => seen.has(t));

  // Strong create signal — at least one create verb AND no
  // explicit read context. The "and no read" cuts down on
  // false positives like "show me a leaderboard of tracker
  // accuracy" (a read about an existing tracker, not a request
  // to make one).
  if (matchedCreate.length > 0 && matchedRead.length === 0) {
    return {
      kind: "create",
      confidence: 1.0,
      reason: `create_token_match:${matchedCreate.join(",")}`,
    };
  }

  // Strong write signal. Same disambiguation: a write verb with
  // no read frame stays a write.
  if (matchedWrite.length > 0 && matchedRead.length === 0) {
    return {
      kind: "write",
      confidence: 1.0,
      reason: `write_token_match:${matchedWrite.join(",")}`,
    };
  }

  // Mixed signals (create+read, write+read) are queries against an
  // existing structure. The LLM follow-up will get this right with
  // contextual reasoning; the heuristic biases to "query" because
  // misclassifying a read as create would mint an unwanted db,
  // while misclassifying create as query just returns 0 rows
  // (recoverable).
  if (matchedRead.length > 0) {
    return {
      kind: "query",
      confidence: 1.0,
      reason: `read_token_match:${matchedRead.join(",")}`,
    };
  }

  // Nothing matched — default to query. The read/write orchestrator's
  // own classifier (LLMOperation `classify`, returns
  // `data_query | meta | destructive`) handles the further triage.
  return { kind: "query", confidence: 0.5, reason: "default_fallback" };
}
