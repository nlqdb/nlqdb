// SK-FRONTIER-001..004 — apps/api wiring for the founder-funded frontier lane.
//
// DORMANT by design. `HAS_FRONTIER_API_KEYS` (hardcoded `false`, SK-FRONTIER-001)
// is checked HERE as the first line AND inside `selectFrontierLane` — so while
// it is `false` this helper returns `null` before any env / KV / founder-key
// access, and `/v1/ask` keeps the free/BYOLLM router unchanged. The wiring is
// present so flipping the one constant activates real behaviour; nothing else
// in the request path changes.
//
// Precedence (the caller only invokes this when the BYOLLM lane was NOT
// selected): a user's own key (BYOLLM) always wins; this only upgrades the
// FREE query path to frontier quality for eligible production traffic with
// budget remaining (SK-FRONTIER-002/003), and is excluded from preview / e2e /
// synthetic-test traffic (SK-FRONTIER-004).

import {
  buildFrontierRouter,
  type FrontierEligibilityCtx,
  type FrontierEnv,
  type FrontierKv,
  frontierTiers,
  HAS_FRONTIER_API_KEYS,
  type LLMRouter,
  selectFrontierLane,
} from "@nlqdb/llm";

// Returns a single-provider frontier `LLMRouter` for the active tier, or
// `null` to keep the free/BYOLLM router. Async (it reads the KV pointer) —
// but only when the lane is enabled AND eligible AND a tier is live.
export async function resolveFrontierAskRouter(
  env: Cloudflare.Env,
  principalKind: string,
  opts: { e2e: boolean },
): Promise<LLMRouter | null> {
  // Dormancy guard (SK-FRONTIER-001): no env/KV/key access while `false`.
  if (!HAS_FRONTIER_API_KEYS) return null;

  // Preview deploys inject `NODE_ENV=preview` / `MOCK_IDP=1` (preview-app.yml).
  const e = env as unknown as { NODE_ENV?: string; MOCK_IDP?: string };
  const isPreview = e.NODE_ENV === "preview" || e.MOCK_IDP === "1";
  const ctx: FrontierEligibilityCtx = {
    // Default-deny: only an explicit `NODE_ENV=production` is eligible, so a
    // deploy that doesn't set it never spends founder budget. Verify the
    // production NODE_ENV before flipping HAS_FRONTIER_API_KEYS
    // (frontier-keys/FEATURE.md Open questions).
    environment: e.NODE_ENV === "production" ? "production" : (e.NODE_ENV ?? "development"),
    isPreview,
    principalKind,
    e2e: opts.e2e,
  };

  const tiers = frontierTiers(env as unknown as FrontierEnv);
  const tier = await selectFrontierLane({ ctx, tiers, kv: env.KV as unknown as FrontierKv });
  if (!tier) return null;

  // The package never reads the secret — apps/api resolves it from env here.
  const apiKey = (env as unknown as Record<string, string | undefined>)[tier.keyEnv];
  if (!apiKey || apiKey.trim() === "") return null;

  return buildFrontierRouter(tier, apiKey);
}
