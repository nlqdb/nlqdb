# SK-LLM-017 — Hosted-premium chain: separate provider list, §6-gated meter, never available on free

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).
Commercial shape (pure-metered, 0% markup, no allowance) is owned by
[`premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md`](../../premium-tier/decisions/SK-PREMIUM-009-hosted-premium-meter.md).

- **Decision:** The router gains a third chain alongside `free` and
  `paid` (the existing `SK-LLM-007` chain), named **`premium`** —
  provider list is Anthropic Claude Sonnet 4.6 + OpenAI GPT-5 + Gemini
  2.5 Pro (frontier-class). The `paid` chain (`SK-LLM-007`) is
  retained for "retention-off non-frontier" routing of Pro requests
  that don't opt into premium (`model: "auto"` or `"fast"`). The
  `premium` chain only fires when (a) `principal.tier !== "free"` AND
  (b) `request.model === "best"` (or auto-classified hard-plan) AND
  (c) feature flag `PREMIUM_METER_LIVE` is on (gated on
  [`phase-plan.md §6`](../../../phase-plan.md) per `SK-PREMIUM-009`).
  Pre-§6 the chain is wired but dark; the trace surfaces
  `pending_premium_launch: true` instead.
- **Core value:** Free, Honest latency, Bullet-proof
- **Why:** Mixing frontier and "retention-off non-frontier" providers
  in one `paid` chain conflates two different value propositions
  (privacy vs accuracy ceiling). Splitting them keeps `SK-LLM-008`
  clean (Pro = retention-off, always) and lets `SK-PREMIUM-009`'s
  meter attach to one chain unambiguously. The §6 flag is the
  architectural gate, not a refactor; the chain wiring lives in
  Phase 2 alongside BYOLLM so the entire LLM-strategy slice ships
  once.
- **Consequence in code:** `LLMRouterOptions.chains` widens to
  `{free, paid, premium}`. New `packages/llm/src/chains/premium.ts`.
  Provider modules for Anthropic / OpenAI / Gemini-Pro added; zero-
  runtime-cost when never instantiated. `chooseChain(req)` becomes a
  three-way selector. Stripe metered subscription items
  (`nlqdb.premium_llm.tokens.<provider>.<model>`) are attached at the
  router span boundary per `SK-PREMIUM-007` (cached plans never bill).
  Per [`GLOBAL-003`](../../../decisions/GLOBAL-003-all-surfaces-one-pr.md),
  surface flags ship together: SDK `model: "best"`, CLI `--model best`,
  MCP `model` param, `<nlq-data model="best">`.
- **Alternatives rejected:**
  - One unified `paid` chain — conflates privacy and accuracy.
  - Always-on premium pre-§6 — no meter = no revenue = `GLOBAL-013`
    violation on heavy use.
  - Per-call provider pick — leaks model strings into customer code
    (already rejected by `SK-PREMIUM-003`).
