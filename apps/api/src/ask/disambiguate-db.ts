// dbId disambiguator (SK-ASK-003 / SK-HDC-005). Layered fast-paths
// before the LLM call:
//
//   1. **Slug substring fast-path** — sub-millisecond local match. If
//      exactly one DB's slug words appear in the goal, pick it with
//      confidence 1.0. Catches the dominant chat case ("show me orders"
//      with `orders-tracker-a4f`) without touching the LLM.
//   2. **KV cache** — per `(tenantId, goalHash, dbsetHash)`. 5/15 ms
//      hot read; mirrors GLOBAL-006 plan-cache pattern.
//   3. **Cheap-tier `llm.disambiguate`** — last resort. The router
//      emits the `llm.disambiguate` span; this module is the typing
//      seam + fast-path orchestration.
//
// The route handler enforces a `confidence ≥ 0.7` floor; below the
// floor (or `chosenId: null`) it returns `409 candidate_dbs`.

import type { DisambiguateCandidate, DisambiguateResponse, LLMRouter } from "@nlqdb/llm";
import type { KVStore } from "../kv-store.ts";

export const DISAMBIGUATE_CONFIDENCE_FLOOR = 0.7;

// Min KV TTL is 60s. Disambiguator cache is keyed by goal+dbset so
// adding/removing a DB naturally evicts. 7 days is the balance: long
// enough that repeat sends in a session almost always hit, short
// enough that DB rename/replacement clears within a week.
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CACHE_KEY_PREFIX = "disambiguate:";

// Words shorter than this are too generic to anchor a slug match
// (e.g. "db", "id", "x"). Avoids matching "id" in "send a slack message".
const SLUG_WORD_MIN_LEN = 4;

export type DisambiguateDeps = {
  llm: LLMRouter;
  // Optional KV — when omitted the cache layer is a no-op (used in
  // tests + dev without a KV binding).
  cache?: KVStore;
};

export type DisambiguateDbInput = {
  tenantId: string;
  goal: string;
  candidates: DisambiguateCandidate[];
};

export async function disambiguateDb(
  deps: DisambiguateDeps,
  input: DisambiguateDbInput,
): Promise<DisambiguateResponse> {
  // Fast-path 1: deterministic slug-substring match. No LLM, no KV.
  const slugMatch = matchBySlug(input.goal, input.candidates);
  if (slugMatch) return slugMatch;

  // Fast-path 2: KV cache. Hashes are content-addressed so a DB
  // add/rename naturally evicts.
  const cacheKey = await buildCacheKey(input.tenantId, input.goal, input.candidates);
  if (deps.cache) {
    const hit = await deps.cache.get(cacheKey);
    if (hit) {
      try {
        const parsed = JSON.parse(hit) as DisambiguateResponse;
        if (validatePick(parsed, input.candidates)) return parsed;
      } catch {
        // Corrupted entry — fall through to LLM and overwrite.
      }
    }
  }

  // LLM. Hallucinated-id guard downgrades to no-pick so the handler
  // returns 409 rather than a wrong-tenant target.
  const result = await deps.llm.disambiguate({
    goal: input.goal,
    candidates: input.candidates,
  });
  const validated = validatePick(result, input.candidates)
    ? result
    : { chosenId: null, confidence: 0, reason: "llm_picked_unknown_id" };

  if (deps.cache) {
    // Fire-and-forget: the response doesn't wait on the cache write.
    // KV.put errors are logged via the parent span if the caller wraps
    // this in waitUntil; here we just swallow.
    deps.cache
      .put(cacheKey, JSON.stringify(validated), { expirationTtl: CACHE_TTL_SECONDS })
      .catch(() => {});
  }
  return validated;
}

// Slug-words appearing in the goal. Words are kebab-segments of the
// slug (e.g. `orders-tracker-a4f` → `orders`, `tracker`); the random
// 6-char tail is filtered out by the SLUG_WORD_MIN_LEN gate but also
// by the "must contain a vowel" check (random base36 tails like
// `a4fxyz` rarely match this).
function matchBySlug(
  goal: string,
  candidates: DisambiguateCandidate[],
): DisambiguateResponse | null {
  const haystack = goal.toLowerCase();
  const matches: { id: string; slug: string; matchedWord: string }[] = [];
  for (const c of candidates) {
    const words = c.slug
      .toLowerCase()
      .split(/[-_]/)
      .filter((w) => w.length >= SLUG_WORD_MIN_LEN && /[aeiou]/.test(w));
    const hit = words.find((w) => haystack.includes(w));
    if (hit) matches.push({ id: c.id, slug: c.slug, matchedWord: hit });
  }
  if (matches.length !== 1) return null;
  const m = matches[0];
  if (!m) return null;
  return {
    chosenId: m.id,
    confidence: 1,
    reason: `slug_match:${m.matchedWord}`,
  };
}

function validatePick(result: DisambiguateResponse, candidates: DisambiguateCandidate[]): boolean {
  if (result.chosenId === null) return true;
  return candidates.some((c) => c.id === result.chosenId);
}

async function buildCacheKey(
  tenantId: string,
  goal: string,
  candidates: DisambiguateCandidate[],
): Promise<string> {
  const goalHash = await sha256Hex(goal.trim().toLowerCase());
  // dbset hash is over the sorted ids — adding/removing a DB changes
  // the fingerprint, evicting old entries naturally.
  const dbsetHash = await sha256Hex(
    [...candidates]
      .map((c) => c.id)
      .sort()
      .join(","),
  );
  return `${CACHE_KEY_PREFIX}${tenantId}:${goalHash}:${dbsetHash}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
