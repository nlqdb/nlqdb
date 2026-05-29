// BYOLLM dispatch-lane selection (SK-LLM-016 / GLOBAL-026).
//
// `SK-LLM-019` landed the provider half — `createByollmProvider`, which
// proxies a user's own key through AI Gateway. This module is the other
// load-bearing, unit-testable core of `SK-LLM-016`: the four-step lane
// precedence and the single-provider router that runs the BYOLLM lane.
//
// What this module deliberately does NOT do (apps/api owns it, in the
// dispatch-wiring PR that also closes GLOBAL-003 surface parity): read
// the `x-nlq-byollm-key` header, decrypt the `api_keys.scope="byollm"`
// blob, or decide premium eligibility. Those need DB + KEK access this
// package must stay free of. The caller resolves credentials and passes
// them in; `selectDispatchLane` is the single source of truth for the
// ordering so it can never drift between surfaces.

import { createByollmProvider } from "./providers/byollm.ts";
import { createLLMRouter, type LLMRouter } from "./router.ts";
import type { ProviderName } from "./types.ts";

// The three permanent dispatch lanes (GLOBAL-026): the user's own key,
// the hosted-premium chain (paid + §6 meter, dark pre-§6 per SK-LLM-017),
// and the always-free strict-$0 chain (SK-LLM-003).
export type DispatchLane = "byollm" | "premium" | "free";

// A resolved BYOLLM credential. The caller resolves these — this package
// never reads headers or the DB. `apiKey` is the user's own provider key,
// billed to them at 0% markup (GLOBAL-026); it rides the auth header only
// and is never placed in a span attribute (see `dispatchLaneAttributes`).
export type ByollmCredential = {
  apiKey: string;
  // AI Gateway upstream slug: `openai` | `anthropic` | `groq` | `google` | …
  upstream: string;
  // Upstream model id as the provider names it (e.g. `gpt-5.2`).
  model: string;
};

// Where the selected credential came from. A per-request header key wins
// over the account-stored key (SK-LLM-016 precedence step 1 > 2).
export type ByollmSource = "header" | "account";

export type DispatchInputs = {
  // Per-request `x-nlq-byollm-key` credential (signed-in only) — step 1,
  // highest precedence when present.
  headerCredential?: ByollmCredential | null;
  // Account-stored credential (`api_keys.scope="byollm"`) — step 2.
  accountCredential?: ByollmCredential | null;
  // Step 3 — true when the principal qualifies for the hosted-premium
  // chain: paid tier AND (`model="best"` or auto-classified hard-plan)
  // AND the §6 meter is live (SK-LLM-017). The caller resolves this; the
  // premium chain itself stays dark pre-§6.
  premiumEligible?: boolean;
};

export type DispatchSelection =
  | { lane: "byollm"; credential: ByollmCredential; source: ByollmSource }
  | { lane: "premium" }
  | { lane: "free" };

// Pure four-step dispatch precedence (SK-LLM-016, GLOBAL-026):
//   1. per-request header key  → byollm
//   2. account-stored key      → byollm
//   3. premium-eligible        → premium
//   4. otherwise               → free
// No I/O — the caller resolves credentials + premium eligibility, this
// just applies the precedence. Keeping it pure makes the ordering a
// single, testable source of truth across every surface.
export function selectDispatchLane(inputs: DispatchInputs): DispatchSelection {
  if (inputs.headerCredential) {
    return { lane: "byollm", credential: inputs.headerCredential, source: "header" };
  }
  if (inputs.accountCredential) {
    return { lane: "byollm", credential: inputs.accountCredential, source: "account" };
  }
  if (inputs.premiumEligible) return { lane: "premium" };
  return { lane: "free" };
}

export type ByollmRouterOptions = {
  credential: ByollmCredential;
  // Cloudflare account + AI Gateway ids for the unified-endpoint URL.
  accountId: string;
  gatewayId: string;
  // Signed-in user id — namespaces the per-tenant cache key (SK-LLM-019).
  userId: string;
  // Gateway-auth token when the AI Gateway is "authenticated"; omit for
  // an open gateway.
  gatewayToken?: string;
};

// Build a single-provider `LLMRouter` for the BYOLLM lane. The user
// picked one model, so every op chains to just `["byollm"]` — there is
// deliberately NO failover to the free chain: silently re-billing us and
// splitting telemetry is exactly what SK-LLM-016 forbids ("fail loud").
// A BYOLLM key failure surfaces as the router's `AllProvidersFailedError`
// for the caller to translate into a one-sentence error (GLOBAL-012).
// The router still gives us the canonical `llm.<op>` span + `gen_ai.*`
// semconv for free. No hedge: hedging duplicates the request to a second
// provider, there is only one here, and every BYOLLM call is the user's
// real money (SK-LLM-014 is free-tier-only).
export function buildByollmRouter(opts: ByollmRouterOptions): LLMRouter {
  const provider = createByollmProvider({
    apiKey: opts.credential.apiKey,
    upstream: opts.credential.upstream,
    model: opts.credential.model,
    accountId: opts.accountId,
    gatewayId: opts.gatewayId,
    userId: opts.userId,
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

// Span attributes for the chosen lane (SK-LLM-016), set by apps/api on
// the ask-pipeline span once the lane is selected. The key value is
// never included — only the lane, who's billed, and (for byollm) the
// upstream slug. `llm.byollm_provider` is the upstream (`openai`/… , ~5
// values), NOT the model, so cardinality stays bounded
// (docs/performance.md §3.3).
export function dispatchLaneAttributes(sel: DispatchSelection): Record<string, string> {
  if (sel.lane === "byollm") {
    return {
      "llm.dispatch_lane": "byollm",
      "llm.billed_to": "byollm",
      "llm.byollm_provider": sel.credential.upstream,
    };
  }
  return { "llm.dispatch_lane": sel.lane, "llm.billed_to": "hosted" };
}
