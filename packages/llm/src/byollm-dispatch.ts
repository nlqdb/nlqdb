// BYOLLM dispatch-precedence resolver — the provider-side core of
// SK-LLM-016 (BYOLLM dispatch lane). Given an already-resolved set of
// credentials and the principal's premium availability, this decides
// which of the three permanent lanes (GLOBAL-026) serves the request:
//
//   1. per-request override key (`x-nlq-byollm-key`, signed-in only)
//   2. account-stored key       (api_keys.scope = "byollm")
//   3. hosted-premium router     (paid + §6 flag — SK-LLM-017)
//   4. free chain                (SK-LLM-003)
//
// This module is deliberately PURE: no DB read, no header parsing, no
// KEK decryption, no network. The API layer that parses the
// `x-nlq-byollm-key` header and decrypts the stored key (the
// dispatch-wiring slice in SK-LLM-016 *Consequence in code*) hands the
// resolved credential in; here we only pick the lane and build the
// BYOLLM provider. Splitting the unit-testable core from the surface
// mirrors how SK-LLM-019 landed the provider factory ahead of its
// surface, and is recorded as SK-LLM-020.
//
// The one correctness-critical guarantee lives here: a *present*
// BYOLLM credential commits to the byollm lane. A structurally-invalid
// credential fails loud at provider construction (GLOBAL-012) rather
// than silently demoting to premium/free — silent demotion is the dark
// pattern SK-LLM-016 rejects, and the documented 2026 BYOK best
// practice (OpenRouter "only", Cloudflare pinned key) is precisely
// "pin one provider, no fallback, fail loud", never Vercel-style
// fall-through to system credentials.

import { createByollmProvider } from "./providers/byollm.ts";
import type { LLMOperation, Provider, ProviderName } from "./types.ts";

// One of GLOBAL-026's three permanent dispatch lanes. Stamped on
// `llm.dispatch_lane` by the wiring slice's middleware.
export type DispatchLane = "byollm" | "premium" | "free";

// A resolved BYOLLM credential. Produced by the API layer — either by
// parsing the `x-nlq-byollm-key` header (per-request override) or by
// decrypting the account-stored `api_keys.scope = "byollm"` blob. The
// shape mirrors `ByollmProviderOptions` minus the gateway coordinates
// and userId, which come from server config + principal, not the key.
export type ByollmCredential = {
  apiKey: string;
  upstream: string;
  model: string;
  gatewayToken?: string;
};

export type ByollmDispatchInput = {
  // Per-request override (`x-nlq-byollm-key`); signed-in only. Highest
  // precedence — when present it wins outright, even over a stored key.
  override?: ByollmCredential;
  // Account-stored key (`api_keys.scope = "byollm"`). Second precedence.
  stored?: ByollmCredential;
  // Whether the hosted-premium lane is available for this principal
  // (paid tier AND §6 meter live — SK-LLM-017). Third precedence; the
  // resolver only signals the lane, premium provider wiring is
  // SK-LLM-017's job.
  premiumAvailable: boolean;
  // AI Gateway coordinates for the unified-endpoint URL (server config).
  gateway: { accountId: string; gatewayId: string };
  // The signed-in user's id — namespaces the per-tenant cache key
  // (SK-LLM-019).
  userId: string;
};

export type ByollmDispatchResult =
  // `source` records which credential won so the middleware can stamp
  // it on the trace without re-deriving the precedence.
  | { lane: "byollm"; provider: Provider; source: "override" | "stored" }
  | { lane: "premium" }
  | { lane: "free" };

// Resolves the dispatch lane for one request. Throws (fail-loud,
// GLOBAL-012) when the selected BYOLLM credential is structurally
// invalid — never demotes a present key to a lower lane.
export function resolveByollmDispatch(input: ByollmDispatchInput): ByollmDispatchResult {
  // Strict precedence: a present override wins outright; the stored key
  // is consulted only when no override is present. For the
  // `ByollmCredential | undefined` contract a present value is always a
  // truthy, non-nullish object, so the `source` ternary and the
  // credential `??` always agree on which key won. A present-but-empty
  // credential is the provider factory's fail-loud concern, not this
  // selector's.
  const source: "override" | "stored" | undefined = input.override
    ? "override"
    : input.stored
      ? "stored"
      : undefined;
  const credential = input.override ?? input.stored;

  if (credential && source) {
    // Build now so a broken credential throws here (GLOBAL-012) instead
    // of silently falling through to premium/free. `createByollmProvider`
    // validates required fields + header-safe userId at construction.
    const provider = createByollmProvider({
      apiKey: credential.apiKey,
      upstream: credential.upstream,
      model: credential.model,
      ...(credential.gatewayToken ? { gatewayToken: credential.gatewayToken } : {}),
      accountId: input.gateway.accountId,
      gatewayId: input.gateway.gatewayId,
      userId: input.userId,
    });
    return { lane: "byollm", provider, source };
  }

  if (input.premiumAvailable) return { lane: "premium" };
  return { lane: "free" };
}

// Single-entry, no-fallback chains for the byollm lane — one per
// operation, all pointing at the lone `byollm` provider. Encoding the
// no-fallback rule here (rather than leaving the wiring slice to build
// the chains by hand) is what makes the fail-loud guarantee structural:
// the router can never silently fall through from a failing BYOLLM key
// to a free provider, because no free provider is in the chain. Matches
// the 2026 BYOK best practice of pinning a single provider with
// fallbacks off.
export function byollmChains(): Record<LLMOperation, ProviderName[]> {
  const only: ProviderName[] = ["byollm"];
  return {
    route: only,
    plan: only,
    summarize: only,
    schema_infer: only,
    engine_classify: only,
  };
}
