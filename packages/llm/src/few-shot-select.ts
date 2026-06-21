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
// Jaccard similarity + stable top-k selection, plus the pool-curation
// schema-identifier mask. Pure + zero-dep so production `buildPlanUser` and the
// eval harness can share it byte-for-byte, exactly like schema-prune.ts. Two
// halves are still staged behind it (not built here):
//   (a) the exemplar *pool* itself — the masked BIRD-dev train-split
//       Question→SQL rows — and, for the hot `plan` path, an embedding index;
//       masked-token Jaccard is the offline, key-free stand-in DAIL's embedding
//       cosine approximates. (`maskWithSchema` below is the masking each pool
//       row + the incoming goal pass through; the rows themselves still need
//       curating.)
//   (b) wiring into `buildPlanUser` behind a per-lever ablation of the static
//       T9 prefix (CLAUDE.md §P5 — don't swap a shipped lever before the
//       cheaper one is attributed).
// The EX delta is the next canonical dispatch (SK-QUAL-002 — PR CI never fires
// real keys), the same prove-the-primitive-offline staging as SK-QUAL-017.

import { schemaTokens, wordTokens } from "./schema-prune.ts";

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

// The pool-curation half of DAIL's mask: replace every question word that
// *names a schema identifier* (a table or column, in any of the snake_case /
// camelCase / plural / spaced spellings `wordTokens` folds together) with one
// `col` placeholder. Value masking alone collapses "albums by the artist named
// <val>" and "employees at the company named <val>" only down to "albums by the
// `col` named val" vs "employees at the `col` named val" — the domain nouns
// (`albums`/`artist`, `employees`/`company`) still differ; masking them too
// yields one shared skeleton "`col` by the `col` named val", which is what lets
// a BIRD exemplar match a query over an unrelated schema (DAIL §4.1).
// Schema-agnostic by design: a word matches only the identifiers present in the
// schema passed with it, so a pool row is masked against its own schema and the
// goal against the live one. Empty/identifier-less schema ⇒ value-only mask.
export function maskSchemaIdentifiers(question: string, schema: string): string {
  const ids = schemaTokens(schema);
  if (ids.size === 0) return question;
  // Word-boundary spans only (skips the `val` placeholders, which carry no
  // letters that overlap an identifier token anyway); a word is masked if any
  // of its folded sub-tokens names a schema identifier.
  return question.replace(/[A-Za-z][A-Za-z\d_]*/g, (word) => {
    if (word === "col" || word === "val") return word;
    for (const t of wordTokens(word)) if (ids.has(t)) return "col";
    return word;
  });
}

// Full DAIL question mask: literal values → `val`, then schema identifiers →
// `col`. Values first so a quoted value that happens to equal a column name
// stays a value slot. This is the skeleton `selectExemplars` should compare
// when a schema is available — both the goal and each pool row are run through
// it (each against its own schema) before similarity.
export function maskWithSchema(question: string, schema: string): string {
  return maskSchemaIdentifiers(maskQuestion(question), schema);
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
