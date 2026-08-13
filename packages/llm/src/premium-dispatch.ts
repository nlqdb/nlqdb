// Hosted-premium dispatch lane (SK-LLM-017 / SK-PREMIUM-009). A single-provider
// `LLMRouter` bound to the PLATFORM's own Anthropic key (not a user key),
// routed through AI Gateway's OpenAI-compat endpoint — the same transport as
// the BYOLLM lane (SK-LLM-019), so we reuse `createByollmProvider` rather than
// duplicate the wire format. The one difference that matters for the meter: a
// per-request `onUsage` sink captures the token usage so the caller can bill
// the query at provider list + 0% markup (SK-PREMIUM-002).
//
// Pure + I/O-free at construction. **Dark by default**: apps/api only builds
// this when an operator has provisioned `PREMIUM_ANTHROPIC_API_KEY` AND flipped
// `PREMIUM_METER_LIVE` (both human-only). Nothing here fires on its own.

import { PREMIUM_MODEL, PREMIUM_PROVIDER } from "./pricing.ts";
import { createByollmProvider } from "./providers/byollm.ts";
import { createLLMRouter, type LLMRouter } from "./router.ts";
import type { ProviderName, TokenUsage } from "./types.ts";

export type PremiumRouterOptions = {
  // The platform's own Anthropic API key (Workers Secret `PREMIUM_ANTHROPIC_API_KEY`).
  // Billed to us; the query's cost is metered back to the customer at 0% markup.
  apiKey: string;
  // Cloudflare account + AI Gateway ids for the unified-endpoint URL.
  accountId: string;
  gatewayId: string;
  // The customer's id — namespaces the per-tenant AI-Gateway cache key so two
  // customers asking the same thing never share a cached completion (SK-LLM-019).
  userId: string;
  gatewayToken?: string;
  // Usage sink — invoked once per LLM call with that call's token usage. The
  // caller accumulates across route/plan/summarize and meters the total.
  onUsage: (usage: TokenUsage) => void;
};

// Build the single-provider premium router. Like `buildByollmRouter`, there is
// deliberately NO failover to the free chain and NO hedge: a premium call is
// real money, and a silent downgrade would hide a failure and split telemetry
// (SK-LLM-016 "fail loud"). A bad key surfaces as `AllProvidersFailedError` for
// the caller to translate into a one-sentence error (GLOBAL-012) — and, per
// SK-PREMIUM-006's decrement-on-dispatch rule, a failed call consumes no
// allowance slot because `onUsage` never fired.
export function buildPremiumRouter(opts: PremiumRouterOptions): LLMRouter {
  const provider = createByollmProvider({
    apiKey: opts.apiKey,
    upstream: PREMIUM_PROVIDER,
    model: PREMIUM_MODEL,
    accountId: opts.accountId,
    gatewayId: opts.gatewayId,
    userId: opts.userId,
    onUsage: opts.onUsage,
    ...(opts.gatewayToken !== undefined ? { gatewayToken: opts.gatewayToken } : {}),
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
