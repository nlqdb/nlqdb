// SK-LLM-041 — similarity-retrieved few-shot exemplar selection
// (DAIL-SQL retrieval half, arXiv:2308.15363 §4.1).
//
// T9 (SK-LLM-026) ships a fixed 3-shot prefix. DAIL-SQL's larger gain is the
// *retrieval* half: pick the exemplars whose question is most similar to the
// incoming goal, so the model sees demonstrations that match the question's
// structure rather than a one-size-fits-all prefix.
//
// The load-bearing trick is **question masking**: DAIL masks domain-specific
// words (literal values, table/column names) before comparing, so similarity
// scores the question's *skeleton* — "how many X named <val>" — not the
// specific entities. That is what lets an exemplar drawn from one schema help
// a question over another (cross-domain retrieval); without masking, two
// structurally identical questions over different domains share almost no
// tokens and a structurally different question that happens to reuse a value
// scores spuriously high.
//
// This module is the deterministic core: question masking + masked-token
// Jaccard similarity + stable top-k selection. Pure + zero-dep so production
// `buildPlanUser` and the eval harness can share it byte-for-byte, exactly
// like schema-prune.ts. Two halves are staged behind it (not built here):
//   (a) the exemplar *pool* — masked BIRD-dev train-split Question→SQL pairs —
//       and, for the hot `plan` path, an embedding index; masked-token Jaccard
//       is the offline, key-free stand-in DAIL's embedding cosine approximates.
//   (b) wiring into `buildPlanUser` behind a per-lever ablation of the static
//       T9 prefix (CLAUDE.md §P5 — don't swap a shipped lever before the
//       cheaper one is attributed).
// The EX delta is the next canonical dispatch (SK-QUAL-002 — PR CI never fires
// real keys), the same prove-the-primitive-offline staging as SK-QUAL-017.

import { wordTokens } from "./schema-prune.ts";

// One exemplar in the retrieval pool: the masking compares on `question`; the
// caller carries whatever rendered demonstration it wants in `payload` (a
// PLAN_FEW_SHOT-shaped string, a {goal, sql} pair, …) so this stays agnostic
// to how the prompt is assembled.
export type Exemplar<T> = {
  question: string;
  payload: T;
};

// Replace every literal value with one placeholder so two questions that
// differ only by their values ("named 'Queen'" vs "named 'Metallica'") read as
// the same skeleton. Quoted strings first (they may contain digits/spaces),
// then bare numbers. The placeholder survives `wordTokens` as the shared token
// `val`, so a value *slot* still counts toward structural overlap — DAIL keeps
// the mask token rather than deleting it for exactly this reason.
//
// Schema-identifier masking (table/column names) is the pool-curation half:
// it needs the schema, which the offline pool stores per row — staged with the
// pool, not here, so the core has zero schema dependency.
export function maskQuestion(question: string): string {
  return question
    .replace(/'[^']*'/g, " val ")
    .replace(/"[^"]*"/g, " val ")
    .replace(/\b\d+(?:\.\d+)?\b/g, " val ");
}

// Masked word-token set of a question — reuses schema-prune's tokenizer so the
// snake_case/camelCase/plural-stripping rules are identical across the planner
// prompt's two pure helpers.
export function maskedTokens(question: string): Set<string> {
  return wordTokens(maskQuestion(question));
}

// Jaccard overlap of two token sets — |A∩B| / |A∪B|. Symmetric, in [0,1],
// zero-dep (DAIL's embedding cosine needs a model; Jaccard is the offline
// stand-in). Two empty sets share no structure ⇒ 0, never 1.
export function questionSimilarity(a: string, b: string): number {
  return jaccard(maskedTokens(a), maskedTokens(b));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Rank the pool by masked-question similarity to `goal` and return the top `k`
// exemplars, most-similar first. Ties break on pool order (earliest wins) so
// selection is reproducible run-to-run — the T8 (SK-LLM-024) determinism
// invariant the eval baseline relies on. A candidate scoring 0 shares no
// structure with the goal; it is dropped rather than padding the prompt with
// an unrelated demonstration (returns fewer than k, never an irrelevant one).
export function selectExemplars<T>(
  goal: string,
  pool: readonly Exemplar<T>[],
  k: number,
): Exemplar<T>[] {
  if (k <= 0 || pool.length === 0) return [];
  const goalTokens = maskedTokens(goal);
  if (goalTokens.size === 0) return [];
  const scored = pool
    .map((ex, index) => ({ ex, index, score: jaccard(goalTokens, maskedTokens(ex.question)) }))
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, k).map((s) => s.ex);
}
