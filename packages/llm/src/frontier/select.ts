// SK-FRONTIER-001 selector + the single-provider router builder + span
// attributes for the founder-funded frontier lane. The three gates run in
// strict order: (1) the hardcoded `HAS_FRONTIER_API_KEYS` constant, (2) the
// `isFrontierEligible` predicate, (3) the KV `frontier:active_tier` pointer.
// Each inner gate only runs once the outer one passed — so while the
// constant is `false`, NO key / env / KV access ever occurs.

import { createChatProvider } from "../providers/_chat-provider.ts";
import { openAICompatibleChat } from "../providers/openai-compatible.ts";
import { createLLMRouter, type LLMRouter } from "../router.ts";
import type { LLMOperation, ProviderName } from "../types.ts";
import { type FrontierEligibilityCtx, isFrontierEligible } from "./eligibility.ts";
import { HAS_FRONTIER_API_KEYS } from "./gate.ts";
import { advanceActiveTier, type FrontierKv, NO_ACTIVE_TIER, readActiveTier } from "./pointer.ts";
import type { FrontierProvider, FrontierTier } from "./tiers.ts";

export type SelectFrontierArgs = {
  // Resolved eligibility signals (SK-FRONTIER-004).
  ctx: FrontierEligibilityCtx;
  // The ordered ladder, already filtered to tiers with a configured key
  // (`frontierTiers(env)`).
  tiers: FrontierTier[];
  // The injected KV pointer store. `apps/api` wires `env.KV`.
  kv: FrontierKv;
};

// The lane selector. Returns the active `FrontierTier` to dispatch to, or
// `null` to fall through to the existing free/BYOLLM/hosted-premium
// precedence. The gate order is load-bearing:
//
//   1. `HAS_FRONTIER_API_KEYS` (SK-FRONTIER-001) — the FIRST line. While
//      `false`, returns `null` before touching `ctx`, `tiers`, or `kv`, so
//      no founder key/env/KV is read in any environment.
//   2. `isFrontierEligible(ctx)` (SK-FRONTIER-004) — pure, no I/O. Excludes
//      preview / non-prod / e2e / synthetic-walker traffic.
//   3. the KV pointer (SK-FRONTIER-003) — one read jumps straight to the
//      live tier; `"none"` (or an empty ladder) ⇒ `null` immediately.
export async function selectFrontierLane(args: SelectFrontierArgs): Promise<FrontierTier | null> {
  if (!HAS_FRONTIER_API_KEYS) return null;
  if (!isFrontierEligible(args.ctx)) return null;
  if (args.tiers.length === 0) return null;

  const activeId = await readActiveTier(args.kv, args.tiers);
  if (activeId === NO_ACTIVE_TIER) return null;

  // Skip tiers with no key — `frontierTiers` already filters these out, so
  // a pointer naming a dropped tier just yields `null` (a fall-through),
  // never a wrong dispatch. Self-healing per SK-FRONTIER-003.
  return args.tiers.find((t) => t.id === activeId) ?? null;
}

// Advance the KV pointer to the next tier after `tier` exhausts its budget
// or returns a hard limit/quota error (429/insufficient_quota). Thin
// wrapper over `advanceActiveTier` so the call site reads as a lane verb;
// `apps/api` calls this from the failover handler. Returns the new pointer
// value (`"none"` once the ladder is spent).
export function onTierExhausted(
  kv: FrontierKv,
  tiers: FrontierTier[],
  tier: FrontierTier,
): Promise<string> {
  return advanceActiveTier(kv, tiers, tier.id);
}

// Per-provider OpenAI-compatible chat-completions endpoints. Both Anthropic
// and OpenAI expose an OpenAI-compatible `/v1/chat/completions`, so the lane
// reuses the same `openAICompatibleChat` caller as the free/BYOLLM
// providers (SK-LLM-002) — no new provider SDK import (GLOBAL-013).
const FRONTIER_ENDPOINTS: Record<FrontierProvider, string> = {
  anthropic: "https://api.anthropic.com/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};

// Single-provider router for the active frontier tier — mirrors
// `buildByollmRouter`. Every op chains to the one tier; on a budget/quota
// failure the router surfaces `AllProvidersFailedError` and the caller
// advances the pointer (`onTierExhausted`) + falls through to free. The
// resolved `apiKey` is read by `apps/api` from `env[tier.keyEnv]` and
// passed in — this package never reads the secret. Built per request
// (cheap; the breaker is inert on a single-provider chain).
export function buildFrontierRouter(tier: FrontierTier, apiKey: string): LLMRouter {
  if (!apiKey || apiKey.trim() === "") {
    // Fail loud (GLOBAL-012) — an empty founder key produces a confusing
    // upstream 401, not an obvious config error.
    throw new Error(`buildFrontierRouter: missing apiKey for frontier tier "${tier.id}"`);
  }
  const url = FRONTIER_ENDPOINTS[tier.provider];
  const models = {
    route: tier.model,
    plan: tier.model,
    summarize: tier.model,
    schema_infer: tier.model,
    engine_classify: tier.model,
  } satisfies Record<LLMOperation, string>;

  // `ProviderName` has no `anthropic`/`openai` literal (the union is the
  // free + byollm providers); the frontier lane reuses the `byollm` label
  // so the failover/cache metric cardinality stays bounded — the actual
  // upstream model rides the `llm.model` span attribute, and the tier id
  // rides `frontierLaneAttributes`.
  const provider = createChatProvider({
    name: "byollm" satisfies ProviderName,
    models,
    callChat: ({ model, messages, jsonMode, temperature, opts: callOpts }) =>
      openAICompatibleChat(
        {
          url,
          apiKey,
          model,
          messages,
          jsonResponse: jsonMode,
          // Greedy (SK-LLM-024) unless the SK-QUAL-017 sampler overrides.
          temperature: temperature ?? 0,
        },
        callOpts,
      ),
  });

  const chain: ProviderName[] = ["byollm"];
  return createLLMRouter({
    providers: [provider],
    chains: {
      route: chain,
      plan: chain,
      summarize: chain,
      schema_infer: chain,
      engine_classify: chain,
    },
  });
}

// Bounded, key-redacted span attributes for the active frontier tier — set
// by apps/api on the ask-pipeline span (mirrors `dispatchLaneAttributes`).
// `llm.billed_to=platform` because the founder eats the cost (it is not a
// user-metered call); the bounded `llm.frontier_tier` (≤ 6 values) +
// `llm.frontier_provider` (2 values) keep cardinality low (performance.md
// §3.3). The key is never an attribute.
export function frontierLaneAttributes(tier: FrontierTier): Record<string, string> {
  return {
    "llm.dispatch_lane": "frontier",
    "llm.billed_to": "platform",
    "llm.frontier_tier": tier.id,
    "llm.frontier_provider": tier.provider,
  };
}

// Test-only seam: the same selector logic with the gate injected as a
// parameter, so a test can exercise the eligibility + pointer gates with
// the gate stubbed `true` WITHOUT flipping the shipped constant. Never
// imported by production code (which always calls `selectFrontierLane`,
// whose gate is the hardcoded `false`).
export async function __selectFrontierLaneForTest(
  hasFrontierApiKeys: boolean,
  args: SelectFrontierArgs,
): Promise<FrontierTier | null> {
  if (!hasFrontierApiKeys) return null;
  if (!isFrontierEligible(args.ctx)) return null;
  if (args.tiers.length === 0) return null;
  const activeId = await readActiveTier(args.kv, args.tiers);
  if (activeId === NO_ACTIVE_TIER) return null;
  return args.tiers.find((t) => t.id === activeId) ?? null;
}
