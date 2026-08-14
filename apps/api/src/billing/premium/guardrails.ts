// Per-query allowance guardrails (SK-PREMIUM-010). Pure + I/O-free — the
// dispatch path applies (1) the hard ceiling BEFORE the LLM call (a refusal
// spends nothing) and (2) the soft-cap slot count AFTER the call, from the
// measured token usage, to decrement the right number of allowance slots.

import { HARD_CEILING_TOKENS, SOFT_CAP_TOKENS } from "./limits.ts";

// SK-PREMIUM-010 (2): a query estimated above the hard ceiling is refused with
// a one-sentence error + next action (GLOBAL-012). We can only estimate before
// dispatch (input tokens); the ceiling is generous enough that the estimate is
// the guard, and the post-call soft-cap slot math catches the rest.
export type HardCeilingVerdict = { ok: true } | { ok: false; maxTokens: number; message: string };

export function checkHardCeiling(estimatedTokens: number): HardCeilingVerdict {
  if (estimatedTokens <= HARD_CEILING_TOKENS) return { ok: true };
  return {
    ok: false,
    maxTokens: HARD_CEILING_TOKENS,
    message: `This question is too large for the hosted-premium tier (over ${HARD_CEILING_TOKENS.toLocaleString()} tokens); split it, or use BYOLLM with a long-context model.`,
  };
}

// SK-PREMIUM-010 (1): allowance slots a query consumes = ceil(tokens / soft_cap),
// minimum 1. A standard query (≤ soft cap) is one slot; an oversize-but-legal
// query pays proportional slot-cost rather than being refused.
export function slotsForTokens(billableTokens: number): number {
  if (billableTokens <= SOFT_CAP_TOKENS) return 1;
  return Math.ceil(billableTokens / SOFT_CAP_TOKENS);
}

// "sized" label for the cost/token histograms (performance.md §3.3 bounded set).
export function sizedBucket(billableTokens: number): "standard" | "large" | "refused" {
  if (billableTokens > HARD_CEILING_TOKENS) return "refused";
  return billableTokens > SOFT_CAP_TOKENS ? "large" : "standard";
}
