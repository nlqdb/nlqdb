# SK-LLM-047 — Cheap-tier chains carry a direct (non-gateway) tail (Cerebras + Mistral)

Parent feature: [`llm-router/FEATURE.md`](../FEATURE.md). Extends the
[`SK-LLM-028`](./SK-LLM-028-mistral-capacity-backstop.md) tail-backstop
pattern from the planner tier to the cheap tier, and closes the
topological gap [`SK-LLM-046`](./SK-LLM-046-ai-gateway-auth-token.md)
named ("no direct-provider backstop") for the free chains.

- **Decision:** `route`, `summarize`, and `engine_classify` append
  **Cerebras** then **Mistral** — both direct-routed, no AI Gateway
  `baseUrl` — behind the four gateway-routed heads
  (`groq`/`gemini`/`workers-ai`/`openrouter`), so **every free chain
  contains at least one leg that does not transit the Cloudflare AI
  Gateway**. Head order is unchanged; `plan`/`schema_infer` already
  satisfy the invariant (Cerebras head per `SK-LLM-023`, Mistral tail
  per `SK-LLM-028`).
- **Core value:** Bullet-proof, Free
- **Why:** The four cheap-tier heads share the AI Gateway as a single
  point of failure, so one gateway fault fails all four legs at once —
  per-provider failover (`SK-LLM-005`) cannot help when every leg
  shares the fault. Observed 2026-08-14: a gateway misconfiguration
  returned `llm_failed` on every signed-in `/v1/ask` for ~1.5 h,
  because `routeAsk` runs on every authed ask (`SK-ASK-009`) and
  `route` was gateway-only — while `plan` (and the anonymous traffic
  that only exercised it) survived on its direct legs. `SK-LLM-046`
  fixed that outage's specific cause (missing gateway auth token); this
  removes the amplifier for the whole class of gateway faults. Tail
  placement keeps the cheap-tier happy path byte-identical — the
  direct legs fire only when every gateway leg is down — and both
  providers are card-free, so `GLOBAL-013` holds.
- **Consequence in code:** the `chains:` block in
  `apps/api/src/llm-router.ts`. Reviewer invariant: **no chain in
  `getLLMRouter()` may consist solely of gateway-`baseUrl` providers**
  — reject an edit that trims the direct tail, or that moves Cerebras
  / Mistral behind the gateway without adding another direct leg. Both
  providers are already registered (`CEREBRAS_API_KEY` /
  `MISTRAL_API_KEY`); an absent key auth-fails harmlessly at the tail,
  same as `SK-LLM-028`. `hedge:` is unchanged (planner-tier ops only).
- **Alternatives rejected:**
  - **Direct-route the cheap tier entirely (drop the gateway)** —
    already rejected in `SK-LLM-046`: throws away the `SK-LLM-004`
    caching / quota / observability.
  - **Lead with Cerebras like `plan`** — changes the measured
    cheap-tier happy path (`SK-ASK-009`'s 1500 ms budget is tuned to
    the Groq head) to defend against a rare fault; tail-only is
    strictly additive.
  - **Gateway health-check + bypass logic** — new machinery
    duplicating what the ordinary chain walk already provides.
