# SK-PREMIUM-008 — BYOLLM: every tier (free + paid), 0% markup, server-side keys only, fail-loud on key error

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** Any authenticated user — free, Hobby, Pro, Enterprise — stores
  one or more provider keys (Anthropic / OpenAI / Gemini — the providers the
  AI Gateway compat endpoint serves, `SK-LLM-021`). When
  selected, the router dispatches through their key at **0% markup** per
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
  Keys live encrypted in `api_keys` with `scope = "byollm"`; KEK is a Workers
  Secret. Per GLOBAL-026 precedence: per-request `x-nlq-byollm-key` header
  (signed-in only) > account-stored > hosted-premium > free. Failures
  (revoked / expired / rate-limited) **fail loud** per
  [`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md) — never
  silent fallback.
- **Core value:** Free, Bullet-proof, Effortless UX, Honest latency
- **Why (resolves the 8-point tree previously held Open):**
  1. **Providers** — Anthropic + OpenAI + Gemini, i.e. the `anthropic` /
     `openai` / `google-ai-studio` providers the AI Gateway
     `/compat/chat/completions` endpoint serves (`SK-LLM-021`). **OpenRouter
     was dropped from BYOLLM** — the compat endpoint doesn't serve it
     (verified 2026-05) and a bespoke per-provider path isn't worth it for
     a capability nobody has asked for (`GLOBAL-033`); OpenRouter stays
     reachable via the free / hosted chain (`SK-LLM-015`). Generic
     OpenAI-compatible endpoint deferred.
  2. **AI Gateway** — through-Gateway with `BYOLLM_<user_id>` namespace;
     eat the cold-cache hop to keep telemetry unified (`SK-LLM-004`).
  3. **Storage** — encrypted blob in `api_keys` + KEK in Workers Secret;
     revocation instant per
     [`GLOBAL-018`](../../../decisions/GLOBAL-018-instant-revocation.md).
     Row schema (envelope in `key_hash`, `scope = "byollm"`) pinned by
     [`SK-PREMIUM-012`](./SK-PREMIUM-012-account-stored-byollm-storage.md).
  4. **Spend cap** — BYOLLM bypasses *our* cap (we don't bill it); emits
     `nlqdb.byollm.spend_estimate_usd_cents` so the dashboard shows
     estimated cost.
  5. **Tier gating** — **free included**; BYOLLM-on-free uses the user's
     quota not ours, and feeds eval signal from heavy users back into the
     engine (`SK-QUAL-004`).
  6. **Failure modes** — 4xx fail-loud; silent fallback is the dark
     pattern.
  7. **Privacy + Pro** — Pro accounts storing a BYOLLM key require a
     per-key retention-off checkbox + audit log entry; otherwise refuse.
  8. **MCP** — server-side only; MCP hosts opt requests into BYOLLM via
     a `byollm: true` tool parameter, never carry the key.
- **Consequence in code:** Migration adds `api_keys.scope = "byollm"` +
  `api_keys.provider` (row schema in `SK-PREMIUM-012`). Endpoints
  `POST/GET/DELETE /v1/keys/byollm` accept `Idempotency-Key` per
  [`GLOBAL-005`](../../../decisions/GLOBAL-005-idempotency-key.md).
  Surface parity per
  [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md):
  `/app/keys` UI section, MCP `byollm` param, SDK `client.byollm.*`,
  CLI `nlq byollm *`, `<nlq-data byollm>` (cookie-session only —
  never raw key in HTML). OTel:
  `llm.dispatch_lane = "byollm"`, `llm.byollm_provider`, key value
  redacted.
- **Alternatives rejected:**
  - **Paid-tier-only BYOLLM** — leaves heavy free-tier abusers no
    escape valve; rejected by GLOBAL-026.
  - **>0% markup** — uncompetitive vs Vercel AI Gateway (0%) and
    OpenRouter (0% on first 1M BYOK requests, 2026).
  - **Around-Gateway dispatch** — loses unified telemetry;
    `quality-eval` (`SK-QUAL-004`) needs BYOLLM-lane instrumentation.
  - **Silent fallback** — dark pattern from GLOBAL-012.
  - **MCP-host-carried keys** — hosts (Claude Desktop / Cursor /
    Zed) can't be audited.

## Resolution history

This SK resolves the "BYOK — decision tree" that lived as an Open question
in `premium-tier/FEATURE.md` until 2026-05. Historical case-for / case-against
that motivated the design:

**Case for BYOK:**
- Customer already has Anthropic / OpenAI credits and doesn't want to double-pay.
- Customer is on an enterprise contract with a specific provider that gives them better-than-list pricing.
- Customer has a data-residency constraint that requires their own provider account (e.g. Azure-hosted OpenAI in a specific region).

**Case against BYOK in v1 (subsequently overturned by `GLOBAL-026`):**
- Surfaces a key-handling problem (per-customer encrypted blob, KEK rotation, leak audit) that we already deferred for "BYO Postgres" to Phase 4+.
- Routes around our 0% markup pricing — if BYOK is the cheap path, the add-on becomes a tax on customers who don't have credits.
- Splits the AI Gateway prompt-cache (`SK-LLM-004`) — BYOK customers don't share the cache namespace; warm-cache wins evaporate.
- Splits the quality-telemetry surface — BYOK responses don't share the `nlqdb.plan.quality_score` histogram if they bypass the Gateway.

The 8 decision points (providers / AI-Gateway / storage / spend-cap / tier-gating / failure-modes / privacy / MCP) are answered in this SK's `Why` field above.
