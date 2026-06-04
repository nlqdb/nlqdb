# SK-LLM-023 — Cerebras (Qwen-3-235B) leads the strict-$0 planner-tier chain

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends the
day-1 chain in [`SK-LLM-003`](./SK-LLM-003-strict-zero-chain.md) — it is
not superseded; Gemini → Groq → Workers-AI → OpenRouter remain the
failover order behind the new head.

- **Decision:** A fifth free-tier provider, **Cerebras**, joins the
  strict-$0 chain and leads the **planner tier** (`plan` + `schema_infer`)
  with **Qwen-3-235B-Instruct-2507**. The new `plan` / `schema_infer`
  order is `[cerebras, gemini, groq, workers-ai, openrouter]`; the
  cheap tier (`route` / `engine_classify`) and `summarize` are
  unchanged (Groq-first per `SK-LLM-001`). Provider:
  `packages/llm/src/providers/cerebras.ts` (OpenAI-compatible,
  base `https://api.cerebras.ai/v1`); key `CEREBRAS_API_KEY`. The eval
  free lane (`tools/eval/src/lanes.ts`) carries the identical chain so
  "the eval measures what production ships" holds.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** The free-chain BIRD-dev execution-accuracy baseline is
  **31.8%** (159/500, `baseline-2026-06-15.json`) — far below the
  `GLOBAL-027` gate floor (BIRD ≥ 65% AND Spider ≥ 75%) that blocks
  every top-5 ICP acquisition flow ([`GLOBAL-032`](../../../decisions/GLOBAL-032-top-5-user-flows-canonical.md);
  every walker dead-ends at gate-403). Free-chain planner quality is
  therefore the single highest-leverage acquisition lever, and the
  planner model is the dominant term. Qwen-3-235B-Instruct-2507 is the
  strongest open-weights NL→SQL model available card-free and the
  fastest (~1,400 tok/s on Cerebras), so it both raises the quality
  ceiling and almost always wins the `SK-LLM-014` hedge before the
  800 ms head-start fires — making it latency-positive, not just
  accuracy-positive. Its free tier (1M tokens/day, no card, verified
  2026-06) satisfies `GLOBAL-013`. The hypothesis — Cerebras-led free
  chain lifts BIRD/Spider EX — is measured, not assumed: the next
  `quality-eval-bird-mini.yml` / `quality-eval-spider2-lite.yml` cron
  produces the delta against `baseline-2026-06-15.json`.
- **Consequence in code:** `createCerebrasProvider` reuses
  `openAICompatibleChat`; `ProviderName` gains `"cerebras"` (the OTel
  `gen_ai` span + failover-metric label come for free through the
  router per `SK-LLM-006`, one new bounded label value). Cerebras is
  routed **direct** (no AI Gateway base yet) — the provider-agnostic
  plan cache (`SK-LLM-010`) is the real cache layer, so the gateway gap
  is cosmetic; gatewaying Cerebras is a follow-up. The free-tier
  **8,192-token context cap** means a schema that overflows it returns
  a 4xx → the router fails over to Gemini next in chain, so
  large-schema questions degrade gracefully rather than erroring to the
  user.
- **Alternatives rejected:**
  - **Append Cerebras last (capacity backstop only)** — barely moves
    accuracy because the free chain rarely fully fails; the lever is
    the *primary* planner model, so it must lead.
  - **Swap Gemini out entirely** — loses the large-schema fallback the
    8,192-token cap requires; keep Gemini as the immediate failover.
  - **Add Mistral / NVIDIA / Cohere instead** — all card-free too, but
    none serve a model at Qwen-3-235B's NL→SQL quality *and* Cerebras's
    throughput; they remain candidate failover entries if Cerebras's
    measured delta disappoints.
  - **Lead the cheap tier (`route`) with Cerebras too** — its 30 RPM
    free cap is unsuited to the hot path, and an 8B model already
    suffices for triage per `SK-LLM-001`.
