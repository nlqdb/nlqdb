# SK-PREMIUM-008 — BYOLLM: every tier (free + paid), 0% markup, server-side keys only, fail-loud on key error

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** Any authenticated user — free, Hobby, Pro, Enterprise — stores
  one or more provider keys (Anthropic / OpenAI / Gemini / OpenRouter). When
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
  1. **Providers** — Anthropic + OpenAI + Gemini + OpenRouter
     (generic OpenAI-compatible endpoint deferred).
  2. **AI Gateway** — through-Gateway with `BYOLLM_<user_id>` namespace;
     eat the cold-cache hop to keep telemetry unified (`SK-LLM-004`).
  3. **Storage** — encrypted blob in `api_keys` + KEK in Workers Secret;
     revocation instant per
     [`GLOBAL-018`](../../../decisions/GLOBAL-018-instant-revocation.md).
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
  `api_keys.provider`. Endpoints `POST/GET/DELETE /v1/keys/byollm`
  accept `Idempotency-Key` per
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
