// BYOLLM provider — routes a signed-in user's own LLM credentials
// through Cloudflare AI Gateway's OpenAI-compatible unified endpoint.
// Implements the provider half of SK-LLM-016 (BYOLLM dispatch lane):
// the user's key is passed straight through (billed to them, 0% markup
// per GLOBAL-026) and a per-tenant cache key namespace keeps two
// tenants asking the same prompt from ever sharing a cached completion
// (SK-LLM-019).
//
// Endpoint / model-prefix / cache-key-header shapes verified against
// the Cloudflare AI Gateway docs (developers.cloudflare.com/ai-gateway,
// fetched 2026-05): the unified OpenAI-compatible endpoint is
// `…/v1/{account}/{gateway}/compat/chat/completions`; the `model` field
// is `<provider>/<model>`; the custom cache-key header is
// `cf-aig-cache-key`; gateway auth (when the gateway is authenticated)
// is `cf-aig-authorization: Bearer <token>`.

import type { LLMOperation, Provider } from "../types.ts";
import { createChatProvider } from "./_chat-provider.ts";
import type { ChatMessage } from "./openai-compatible.ts";
import { openAICompatibleChat } from "./openai-compatible.ts";

export type ByollmProviderOptions = {
  // The signed-in user's own provider API key. Passed through to the
  // upstream as `Authorization: Bearer …` — billed to the user, never
  // stored in a span or log (only ever sent in the auth header).
  apiKey: string;
  // Upstream provider slug as AI Gateway names it for the unified
  // endpoint's `<provider>/<model>` form: `openai`, `anthropic`,
  // `google-ai-studio`, `grok`, … . Prefixed onto the model. `openrouter`
  // is special-cased below (dedicated path, raw model id).
  upstream: string;
  // Model id as the upstream names it (e.g. `claude-sonnet-5`, or an
  // OpenRouter id like `openai/gpt-5.6`). The user picks one model; every
  // operation uses it.
  model: string;
  // Cloudflare account id + AI Gateway id for the unified-endpoint URL.
  accountId: string;
  gatewayId: string;
  // The signed-in user's id — namespaces the per-tenant cache key so
  // two tenants asking an identical prompt never share a cached
  // completion (SK-LLM-019).
  userId: string;
  // Gateway-auth token (`cf-aig-authorization`) when the AI Gateway is
  // set to "authenticated". Omit for an open gateway.
  gatewayToken?: string;
};

// Per-tenant, per-request cache key: `BYOLLM_<userId>_<sha256(request)>`.
// The user prefix isolates tenants (no cross-tenant cache hit); the
// content hash preserves real caching (the same user asking the same
// thing still hits cache and saves their own tokens). `crypto.subtle`
// is available on Workers, Bun and Node ≥ 20 — no polyfill needed.
async function namespacedCacheKey(
  userId: string,
  model: string,
  jsonMode: boolean,
  messages: ChatMessage[],
): Promise<string> {
  const payload = JSON.stringify({ model, jsonMode, messages });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `BYOLLM_${userId}_${hex}`;
}

export function createByollmProvider(opts: ByollmProviderOptions): Provider {
  // Fail loud on a misconfigured lane (GLOBAL-012) — an empty
  // accountId / gatewayId / key produces a confusing upstream 404,
  // not an obvious config error, so we surface it at construction.
  const required = {
    apiKey: opts.apiKey,
    upstream: opts.upstream,
    model: opts.model,
    accountId: opts.accountId,
    gatewayId: opts.gatewayId,
    userId: opts.userId,
  };
  // Reject blank AND whitespace-only values: a `"   "` key is truthy but
  // produces a confusing upstream 401, not an obvious config error — so
  // surface it loud at construction (GLOBAL-012).
  const missing = Object.entries(required)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`createByollmProvider: missing required option(s): ${missing.join(", ")}`);
  }
  // `userId` is interpolated into the `cf-aig-cache-key` header value —
  // constrain it to header-safe chars (Better-Auth ids already are) so
  // it can never carry control chars into the header (GLOBAL-012).
  if (!/^[A-Za-z0-9_-]+$/.test(opts.userId)) {
    throw new Error(
      `createByollmProvider: userId must match [A-Za-z0-9_-]+ (got "${opts.userId}")`,
    );
  }

  // Most providers route through the unified OpenAI-compat endpoint with a
  // `<provider>/<model>` model field. OpenRouter is the exception: the AI
  // Gateway serves it only on a dedicated `/openrouter/chat/completions` path
  // (not the compat endpoint) and takes the raw OpenRouter model id — which
  // already carries its own `<vendor>/<model>` form (e.g. `openai/gpt-5.6`).
  // Verified against developers.cloudflare.com/ai-gateway, 2026-07 (SK-LLM-019).
  const isOpenRouter = opts.upstream === "openrouter";
  const qualifiedModel = isOpenRouter ? opts.model : `${opts.upstream}/${opts.model}`;
  const path = isOpenRouter ? "openrouter/chat/completions" : "compat/chat/completions";
  const url = `https://gateway.ai.cloudflare.com/v1/${opts.accountId}/${opts.gatewayId}/${path}`;
  // One user-chosen model serves every operation.
  const models = {
    route: qualifiedModel,
    plan: qualifiedModel,
    summarize: qualifiedModel,
    schema_infer: qualifiedModel,
    engine_classify: qualifiedModel,
  } satisfies Record<LLMOperation, string>;

  return createChatProvider({
    name: "byollm",
    models,
    callChat: async ({ model, messages, jsonMode, temperature, opts: callOpts }) => {
      const cacheKey = await namespacedCacheKey(opts.userId, model, jsonMode, messages);
      return openAICompatibleChat(
        {
          url,
          apiKey: opts.apiKey,
          model,
          messages,
          jsonResponse: jsonMode,
          // Greedy (SK-LLM-024) unless the SK-QUAL-017 sampler overrides.
          temperature: temperature ?? 0,
          headers: {
            "cf-aig-cache-key": cacheKey,
            ...(opts.gatewayToken ? { "cf-aig-authorization": `Bearer ${opts.gatewayToken}` } : {}),
          },
        },
        callOpts,
      );
    },
  });
}
