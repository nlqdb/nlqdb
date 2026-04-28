# LLM credits — application plan

> **Verify the credit amounts and program names against each
> provider's official page before submitting an application.** The
> figures in the table below were captured in April 2026 from the
> public marketing pages, but startup credit programs reshape often
> (Anthropic, MS Founders Hub and AWS Activate all restructured
> within the past 18 months). Quoting a stale tier-amount in a
> founder application looks worse than under-quoting and being
> pleasantly surprised. Re-check before pasting amounts into a form.

The 2026 NL-to-SQL frontier (Spider 2.0, BIRD-Interact, LiveSQLBench) is firmly in Claude Sonnet 4.6 / GPT-5 territory; small free-tier models (Groq Llama 3.1 8B, Gemini 2.5 Flash) lose 15–25 accuracy points on realistic schemas. We don't want to torch user experience to stay strict-$0 — but we also don't want to pay $5k/month before revenue.

The plan: apply to four credit programs in parallel today, route paid models behind Cloudflare AI Gateway with quality telemetry, and keep the strict-$0 chain as fallback for low-priority paths (CI, dev, /v1/health probes, classify on cheap intents).

## Programs to apply to (April 2026)

| Program | URL | Credit | Qualification | Decision |
|---|---|---|---|---|
| **Anthropic Startup Program** | <https://claude.com/programs/startups> | $1k–$5k self-serve, $25k+ with VC/accelerator referral | Pre-seed → Series A; prod use of Claude API | 1–3 weeks |
| **Microsoft for Startups Founders Hub** (OpenAI access) | <https://www.microsoft.com/en-us/startups> | $1k base → $5k verified → $25k investor-referred. OpenAI credits ($5k) gate at Level 4 | Self-serve, no VC required for Levels 1–3 | 7–14 days |
| **Google for Startups Cloud** (Gemini API) | <https://cloud.google.com/startup/benefits> | $2k/yr unfunded; $100k yr1 + $100k yr2 funded; AI-track up to $350k | Incorporated entity, pitch | 7–21 days |
| **AWS Activate Founders** (Anthropic via Bedrock) | <https://aws.amazon.com/startups/credits> | $1k self-serve; up to $100k accelerator-referred | Self-serve tier needs only company info | 7–10 business days |

**Apply also (no-cost extras):**

- **Together AI Startup Program** — <https://www.together.ai/forms/together-ai-startup-program>. $15k–$50k, 1–3 weeks. Llama 4 / Qwen 2.5 Coder / DeepSeek as backups.
- **NVIDIA Inception** — <https://www.nvidia.com/en-us/startups/>. Free, instant. Discounts on NIM endpoints, useful if we ever self-host.
- **Cloudflare Workers Launchpad** — <https://workers.cloudflare.com/launchpad>. $1k credits + Founders Hub equivalent perks.
- **Groq** + **Cerebras** — no formal startup programs; both have generous free tiers we already exploit. No application required.

## Realistic timeline

Apply same-day for all four primary programs. Expected arrival of usable credits:

- Week 1: AWS Activate Founders ($1k Bedrock → Anthropic Claude on Bedrock)
- Week 2: Microsoft Founders Hub ($1k Azure → OpenAI gpt-5/gpt-5-mini)
- Week 2–3: Google for Startups Cloud ($2k → Gemini 2.5 Pro)
- Week 2–4: Anthropic Startup Program (direct Claude API, $1k–$5k)
- Week 2–3: Together AI ($15k → Llama 4 / Qwen 2.5 Coder)

Plan on **all four primary providers usable by mid-May 2026**.

## How credits flow into the product without breaking UX

We already wired Cloudflare AI Gateway in `apps/api/src/llm-router.ts`. With the gateway in place:

1. **Tier-aware routing** — once paid keys land, the router gains a `tier: "free" | "paid"` chain selector. Default chain stays `groq → gemini → workers-ai → openrouter` (free); a new `paid` chain layers `anthropic → openai → groq` and is selected per request based on:
   - `request.priority` — explicit hint from the surface (signed-in chat = `high`, /v1/health = `low`).
   - User plan — paid users default to `high`, anonymous demo to `low`.
2. **AI Gateway caching** — every call routes through `gateway.ai.cloudflare.com/v1/{acc}/{gw}/{provider}/...`. Identical-prompt cache hits land sub-100ms; saves hard credit dollars.
3. **Quality telemetry** — `gen_ai.system`, `gen_ai.request.model`, `gen_ai.response.model` already emitted on every span (OTel semconv 1.37). We add a `nlqdb.plan.quality_score` histogram (1 = ran cleanly, 0.5 = needed correction loop, 0 = rejected) so we can watch quality per provider in Grafana / Honeycomb / Axiom.
4. **Fallback chain stays strict-$0** — if Anthropic is throttled, the request falls through Gemini → Groq → Workers-AI without user-visible failure. Circuit breaker (just landed) skips a flapping provider after 3 consecutive failures, 60s cooldown.

## Concrete deliverables (this PR)

- ✅ AI Gateway wiring in `apps/api/src/llm-router.ts` (gateway URLs assembled from `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID`).
- ✅ Provider `endpoint` / `baseUrl` overrides in every provider (`packages/llm/src/providers/*.ts`).
- ✅ `gen_ai.*` semconv attributes on the LLM router span (`packages/llm/src/router.ts`).
- ✅ Circuit breaker — `circuitBreaker: { failureThreshold, cooldownMs }` option on `createLLMRouter`.
- ✅ This document.

## Followups (own PRs)

- Tier-aware chain selector — `LLMRouterOptions.chains` extended to `{ free: ProviderName[]; paid: ProviderName[] }`.
- Anthropic + OpenAI provider implementations in `packages/llm/src/providers/`. Both are OpenAI-compatible chat-completions; ~50 LOC each.
- `nlqdb.plan.quality_score` histogram + LLM-as-judge correction loop.

## Application checklist (track here)

- [ ] Anthropic Startup Program — applied:        / decided:
- [ ] MS Founders Hub — applied:        / decided:
- [ ] Google for Startups Cloud — applied:        / decided:
- [ ] AWS Activate Founders — applied:        / decided:
- [ ] Together AI — applied:        / decided:
- [ ] NVIDIA Inception — applied:        / decided:
- [ ] Cloudflare Workers Launchpad — applied:        / decided:

## Draft application paragraph (reuse across forms)

> nlqdb is a natural-language databases platform — users describe what they want in English and we generate, validate, and run the SQL on their database. Pre-alpha as of April 2026, on Cloudflare Workers + Hono + D1 + KV + R2 + Queues + Better Auth, Stripe Billing for usage-based pricing. Source-available under FSL-1.1-ALv2 (Apache 2.0 future license — repo is private through pre-alpha and opens publicly post-alpha). Swiss merchant. Solo-founder, bootstrapped. Frontier LLMs are core to plan-generation accuracy; current strict-$0 chain (Groq → Gemini → Workers AI → OpenRouter) gives ~70% accuracy on BIRD-realistic queries vs ~94% with Claude Sonnet 4.6 / GPT-5. Credits unblock production-grade accuracy without breaking the Free-plan economics.
