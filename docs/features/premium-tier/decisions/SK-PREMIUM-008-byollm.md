# SK-PREMIUM-008 — BYOLLM: every tier (free + paid), 0% markup, server-side keys only, fail-loud on key error

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** Any authenticated user — free, Hobby, Pro, Enterprise — stores
  one or more provider keys (Anthropic / OpenAI / Gemini / OpenRouter). When
  selected, the router dispatches through their key at **0% markup** per
  [`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
  Keys live encrypted in a dedicated `byollm_keys` table; KEK is a Workers
  Secret. Per GLOBAL-026 precedence: per-request `x-nlq-byollm-key` header
  (signed-in only) > account-stored > hosted-premium > free. Failures
  (revoked / expired / rate-limited) **fail loud** per
  [`GLOBAL-012`](../../../decisions/GLOBAL-012-one-sentence-errors.md) — never
  silent fallback.
- **Core value:** Free, Bullet-proof, Effortless UX, Honest latency
- **Why (resolves the 8-point tree previously held Open):**
  1. **Providers** — Anthropic + OpenAI + Gemini + OpenRouter
     (generic OpenAI-compatible endpoint deferred).
  2. **AI Gateway** — through-Gateway with `BYOLLM_<user_id>` namespace;
     eat the cold-cache hop to keep telemetry unified (`SK-LLM-004`).
  3. **Storage** — dedicated `byollm_keys` table (migrations 0016 + 0017),
     AES-GCM encrypted with HKDF-SHA-256(KEK); KEK in Workers Secret;
     revocation instant per
     [`GLOBAL-018`](../../../decisions/GLOBAL-018-instant-revocation.md).
     Separate table rather than extending `api_keys`: no key-hash lookup,
     no `db_id` scope, and an `llm_provider` discriminant avoids a
     CHECK-constraint migration on `api_keys`.
  4. **Spend cap** — BYOLLM bypasses *our* cap (we don't bill it); emits
     `nlqdb.byollm.spend_estimate_usd_cents` so the dashboard shows
     estimated cost.
  5. **Tier gating** — **free included**; BYOLLM-on-free uses the user's
     quota not ours, and feeds eval signal from heavy users back into the
     engine (`SK-QUAL-004`).
  6. **Failure modes** — 4xx fail-loud; silent fallback is the dark
     pattern. D1 infra errors on the stored-key lookup fall through to the
     free chain with `nlqdb.ask.byollm_source = "fallthrough_d1_error"` on
     the span — never completely silent.
  7. **Privacy + Pro** — Pro accounts storing a BYOLLM key require a
     per-key retention-off checkbox + audit log entry; otherwise refuse.
  8. **MCP** — server-side only; MCP hosts opt requests into BYOLLM via
     a `byollm: true` tool parameter, never carry the key.
- **Consequence in code:** Migrations 0016 + 0017 create the `byollm_keys`
  table with a partial UNIQUE index enforcing one active key per
  `(tenant_id, llm_provider)`. Endpoints `POST/GET/DELETE /v1/keys/byollm`
  accept `Idempotency-Key` per
  [`GLOBAL-005`](../../../decisions/GLOBAL-005-idempotency-key.md).
  POST response is `{ id, provider, last4 }` — plaintext key is NOT echoed
  back. OTel on the ask/chat span: `nlqdb.ask.byollm_provider`,
  `nlqdb.ask.byollm_source` (`"header"` | `"stored"` | `"fallthrough_d1_error"`);
  key value is never an attribute.
  **Surface gap (GLOBAL-003 / SK-PREMIUM-005):** SDK `client.byollm.*`,
  CLI `nlq byollm *`, MCP `byollm` param, `<nlq-data byollm>`, and
  `/app/keys` UI are deferred — tracked in Open questions in
  [`premium-tier/FEATURE.md`](../FEATURE.md).
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
