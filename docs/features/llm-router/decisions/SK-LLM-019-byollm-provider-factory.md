# SK-LLM-019 — BYOLLM provider factory: AI Gateway unified endpoint + `cf-aig-cache-key` tenant namespace

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Implements the
**provider half** of
[`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md) (the dispatch-precedence
decision). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** `createByollmProvider` (`packages/llm/src/providers/byollm.ts`)
  builds a standard `Provider` from a signed-in user's own credentials
  and routes it through Cloudflare AI Gateway's **OpenAI-compatible
  unified endpoint**
  `https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/compat/chat/completions`.
  Three concrete shapes are pinned here (verified against the Cloudflare
  AI Gateway docs, fetched 2026-05):
  - **Key pass-through.** The user's provider key rides
    `Authorization: Bearer <key>` — billed to them, 0% markup per
    `GLOBAL-026`. It is never persisted in a span/log (auth header
    only).
  - **Model qualifier.** The user's one chosen model is sent as
    `<upstream>/<model>` (e.g. `openai/gpt-5.2`, `anthropic/claude-4-5-sonnet`)
    for every operation, as the unified endpoint requires.
  - **Tenant cache namespace.** `SK-LLM-016`'s abstract
    "namespace `BYOLLM_<user_id>`" resolves to the
    **`cf-aig-cache-key` header** set to
    `BYOLLM_<userId>_<sha256(model + jsonMode + messages)>`. The user
    prefix isolates tenants (no cross-tenant cache hit); the content
    hash preserves real per-prompt caching (a user re-asking the same
    thing still hits cache and saves their own tokens).

  Gateway auth (`cf-aig-authorization: Bearer <token>`) is sent only
  when an authenticated gateway token is supplied. The factory fails
  loud (`GLOBAL-012`) at construction on any missing — or blank /
  whitespace-only — required option (a `"   "` key is truthy but only
  surfaces as a confusing upstream 401).
- **Core value:** Free, Bullet-proof, Effortless UX
- **Why:** A pure provider factory is the load-bearing, unit-testable
  core of `SK-LLM-016` — it reuses the existing `createChatProvider` +
  `openAICompatibleChat` plumbing (so prompts, JSON parsing, OTel spans,
  failover, and the circuit breaker all apply unchanged) and isolates
  the only genuinely-new BYOLLM concerns: endpoint URL, key
  pass-through, model qualifier, and per-tenant cache safety. Resolving
  the cache-namespace mechanism on principle (`cf-aig-cache-key` keyed
  by user + content) closes the one correctness trap in the abstract
  "namespace" wording — a static per-user key would have collapsed
  every prompt to one cached answer.
- **Consequence in code:**
  - `packages/llm/src/providers/byollm.ts` — the factory (new).
  - `packages/llm/src/providers/openai-compatible.ts` — `ChatRequest`
    gains an optional `headers` map, merged *under* the fixed
    `content-type` / `authorization` so a caller can never clobber
    auth. Carries the two `cf-aig-*` control headers.
  - `packages/llm/src/types.ts` — `ProviderName` widens with
    `"byollm"`; bounded label, the upstream identity rides `llm.model`.
  - `packages/llm/src/index.ts` — exports `createByollmProvider` +
    `ByollmProviderOptions`.
- **Gap (per `GLOBAL-003`):** This slice is the provider primitive
  only. The user-facing surface — the `x-nlq-byollm-key` header and
  `api_keys.scope = "byollm"` key storage, the middleware that selects
  the lane and resolves the key, and SDK / CLI / MCP / elements parity
  — is the **dispatch-wiring** slice tracked in
  [`SK-LLM-016`](./SK-LLM-016-byollm-dispatch.md) *Consequence in code*.
  No user-callable capability is added here, so `GLOBAL-003` parity is
  deferred to that PR, not violated by this one.
- **Alternatives rejected:**
  - **Static per-user cache key (`BYOLLM_<userId>` alone).** Overrides
    the whole key, so every distinct prompt collapses to one cached
    answer — silently wrong. The content hash is required.
  - **Skip AI Gateway, call the upstream directly.** Loses the unified
    telemetry `SK-LLM-016` relies on to keep `quality-eval`'s
    instrumentation consistent across lanes; also forfeits gateway-side
    caching/rate-limit.
  - **A bespoke caller instead of reusing `openAICompatibleChat`.**
    Duplicates error classification + body redaction; the optional
    `headers` field is a two-line, backward-compatible extension.
  - **Ship the full vertical (middleware + key storage + all surfaces)
    in one PR.** Larger blast radius; the provider primitive is the
    cleanly-testable unit that every surface depends on, so it lands
    first behind the existing `SK-LLM-016` gap annotation.
