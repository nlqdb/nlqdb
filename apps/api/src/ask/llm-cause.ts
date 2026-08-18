// SK-LLM-050 — carry the router's already-computed failure cause into the
// `llm_failed` envelope, bounded and secret-free.
//
// `AllProvidersFailedError.attempts` holds one `{provider, reason}` per chain
// leg; `ProviderError.reason` holds it for a single-provider (BYOLLM / premium)
// router. Both were thrown away at the orchestrator boundary, which is why a
// 401 from a user's own key surfaced as "couldn't generate a plan — try
// rephrasing" (2026-08-17). Only the bounded enum, the provider slug, and the
// model id cross the boundary; the provider's own message — which can carry
// prompt fragments or the key itself — stays on the `llm.plan` span, exactly as
// the security comment in `orchestrate.ts` requires.

import {
  AllProvidersFailedError,
  type FailoverReason,
  NoConfiguredProvidersError,
  ProviderError,
} from "@nlqdb/llm";
import type { AskError } from "./types.ts";

export type LlmLaneInfo = {
  lane?: "free" | "byollm" | "premium" | "frontier";
  /** AI Gateway upstream slug on a BYOLLM lane (`openai`, `anthropic`, …). */
  provider?: string;
  /** Upstream model id the user pinned. Never a key. */
  model?: string;
};

// The reason that best explains a whole-chain failure. `auth_denied` and
// `not_configured` win over transient ones: if any leg is locked out, saying
// "try again in a minute" is the lie the user acts on for free.
const STICKY: FailoverReason[] = ["auth_denied", "not_configured"];

function chainReason(attempts: { provider: string; reason: FailoverReason }[]) {
  const sticky = attempts.find((a) => STICKY.includes(a.reason));
  return sticky ?? attempts[attempts.length - 1];
}

export function llmFailure(err: unknown, lane: LlmLaneInfo = {}): AskError & { code: "llm_failed" } {
  const base = {
    code: "llm_failed" as const,
    ...pick("lane", lane.lane),
    ...pick("model", lane.model),
  };
  if (err instanceof NoConfiguredProvidersError) {
    return { ...base, reason: "not_configured", ...pick("provider", lane.provider) };
  }
  if (err instanceof AllProvidersFailedError) {
    const worst = chainReason(
      err.attempts.map((a) => ({ provider: String(a.provider), reason: a.reason })),
    );
    return {
      ...base,
      ...pick("reason", worst?.reason),
      // On a single-provider lane the caller's slug (the AI Gateway upstream
      // the user configured) reads better than the internal provider name.
      ...pick("provider", lane.provider ?? worst?.provider),
    };
  }
  if (err instanceof ProviderError) {
    return { ...base, reason: err.reason, ...pick("provider", lane.provider) };
  }
  return { ...base, ...pick("provider", lane.provider) };
}

function pick<K extends string, V>(key: K, value: V | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
