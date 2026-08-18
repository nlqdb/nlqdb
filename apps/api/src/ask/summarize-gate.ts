// SK-ASK-005 — decides whether the post-exec `llm.summarize` hop runs.
// Pure so it's tested in isolation and the LLM call is skipped *before*
// it's made (no wasted token spend on a summary we'd discard).
//
// Skip when the caller opted out (`Accept: application/json` /
// agent-memory DBs) OR when the result set is empty. An empty set is the
// one input where narration can only fabricate — with no rows to describe,
// the model invents global claims ("there are no members") or speculates
// about actions never taken. Non-empty sets keep prose: the summary IS the
// chat voice, and the SK-LLM anti-fabrication directives bound what it can
// assert. Prompt-token cost is already capped at 50 rows in `buildSummarizeUser`.

export function shouldSummarize(rowCount: number, opts: { skipSummary: boolean }): boolean {
  if (opts.skipSummary) return false;
  return rowCount > 0;
}
