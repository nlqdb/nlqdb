// Per-request BYOLLM lane for `/v1/ask` — the apps/api half of
// `SK-LLM-016` step 1 (the `x-nlq-byollm-key` header). The pure
// precedence + provider primitives live in `@nlqdb/llm`
// (`SK-LLM-019`/`SK-LLM-020`); this module parses + authorizes the header
// into a `ByollmCredential` and resolves which `LLMRouter` the ask
// pipeline runs on, so the wire format and the signed-in-only gate live
// in one tested place rather than inline in the route handler.
//
// Scope: header lane only. Account-stored keys (`api_keys.scope="byollm"`,
// KEK-decrypt) and the hosted-premium chain (`SK-LLM-017`, dark pre-§6)
// are not wired here — both stay on the free router. Surface parity
// (SDK/CLI/MCP/elements) is tracked as a gap in `premium-tier/FEATURE.md`
// per `GLOBAL-003`.

import {
  type ByollmCredential,
  buildByollmRouter,
  dispatchLaneAttributes,
  type LLMRouter,
  selectDispatchLane,
} from "@nlqdb/llm";

export type { ByollmCredential } from "@nlqdb/llm";

// Canonical header name (`SK-PREMIUM-008`). Lower-case — Hono normalises
// header lookups, but keeping the constant lower-case matches the wire.
export const BYOLLM_HEADER = "x-nlq-byollm-key";

// AI Gateway compat-endpoint provider slugs we accept for BYOLLM. Pinned
// to the `<provider>/<model>` slugs the unified `/compat/chat/completions`
// endpoint actually serves (verified against developers.cloudflare.com/
// ai-gateway, 2026-05): `openai`, `anthropic`, `google-ai-studio`.
// `SK-PREMIUM-008` also lists OpenRouter, but it is not a compat-endpoint
// provider — tracked as a gap in `premium-tier/FEATURE.md`. An unknown
// slug fails loud here (GLOBAL-012) rather than 404-ing at the gateway.
export const SUPPORTED_BYOLLM_PROVIDERS = ["openai", "anthropic", "google-ai-studio"] as const;
const SUPPORTED = new Set<string>(SUPPORTED_BYOLLM_PROVIDERS);

// One-sentence header-shape message (GLOBAL-012), reused by the malformed
// branches so the contract reads identically wherever it surfaces.
const SHAPE_MESSAGE = `${BYOLLM_HEADER} must be "<provider>:<model>:<key>" (e.g. "openai:gpt-5.2:sk-…").`;

export type ParseByollmResult =
  // `credential: null` means the header was absent or blank — no BYOLLM
  // intent, dispatch falls through to the free chain.
  { ok: true; credential: ByollmCredential | null } | { ok: false; message: string };

// Parse the `x-nlq-byollm-key` header into a credential. Pure + I/O-free.
// Format: `<provider>:<model>:<key>`. We split on the first two colons
// only and take the remainder as the key, so a key containing a colon
// survives intact; provider slugs and the supported providers' model ids
// never contain a colon. Fails loud on a malformed value or an
// unsupported provider (GLOBAL-012) — a confusing upstream 4xx is worse
// than an obvious 400 at the edge.
export function parseByollmHeader(raw: string | undefined): ParseByollmResult {
  if (raw === undefined) return { ok: true, credential: null };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, credential: null };

  const firstColon = trimmed.indexOf(":");
  const secondColon = firstColon === -1 ? -1 : trimmed.indexOf(":", firstColon + 1);
  if (firstColon === -1 || secondColon === -1) {
    return { ok: false, message: SHAPE_MESSAGE };
  }

  const upstream = trimmed.slice(0, firstColon).trim().toLowerCase();
  const model = trimmed.slice(firstColon + 1, secondColon).trim();
  const apiKey = trimmed.slice(secondColon + 1).trim();
  if (model === "" || apiKey === "") return { ok: false, message: SHAPE_MESSAGE };
  if (!SUPPORTED.has(upstream)) {
    return {
      ok: false,
      message: `BYOLLM provider "${upstream}" is not supported; use one of ${SUPPORTED_BYOLLM_PROVIDERS.join(", ")}.`,
    };
  }
  return { ok: true, credential: { apiKey, upstream, model } };
}

export type ResolveAskRouterResult =
  | { ok: true; router: LLMRouter; attributes: Record<string, string> }
  // The deployment has a BYOLLM key inbound but no AI Gateway configured
  // — an operator-config gap, surfaced as 503 by the caller (not 4xx: the
  // request is well-formed, the platform just can't serve the lane).
  | { ok: false; reason: "gateway_unconfigured" };

// Resolve the ask-pipeline router from the per-request credential.
// Header credential → BYOLLM router through the user's own key; otherwise
// the free router. (Account-stored + premium lanes aren't wired this
// slice; `selectDispatchLane` still owns the precedence so adding them is
// a one-field change.) Returns the redacted `llm.dispatch_lane` span
// attributes alongside, so the caller annotates the existing ask span
// without a second source of truth. Pure + I/O-free.
export function resolveAskRouter(args: {
  headerCredential: ByollmCredential | null;
  freeRouter: LLMRouter;
  gateway: { accountId?: string; gatewayId?: string };
  userId: string;
}): ResolveAskRouterResult {
  const selection = selectDispatchLane({ headerCredential: args.headerCredential });
  const attributes = dispatchLaneAttributes(selection);
  if (selection.lane !== "byollm") {
    return { ok: true, router: args.freeRouter, attributes };
  }
  const { accountId, gatewayId } = args.gateway;
  if (!accountId || !gatewayId) return { ok: false, reason: "gateway_unconfigured" };
  const router = buildByollmRouter({
    credential: selection.credential,
    accountId,
    gatewayId,
    userId: args.userId,
  });
  return { ok: true, router, attributes };
}
