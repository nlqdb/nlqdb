# GLOBAL-026 — LLM strategy: free-forever chain, BYOLLM for everyone, hosted premium on paid

- **Decision:** The LLM access model has three permanent layers. They
  do **not** swap at "launch" — they coexist for the life of the
  product.

  1. **Free LLM router — forever, on the free tier.** The strict-$0
     provider chain (Gemini Flash → Groq → Workers-AI → OpenRouter
     free, current shape in
     [`SK-LLM-003`](../features/llm-router/FEATURE.md)) is the
     default path for every unauthenticated and free-tier-authenticated
     request. There is no "post-launch" cliff. Strict-$0 stays the
     contract for the free tier indefinitely.
  2. **BYOLLM — for every user, every tier.** Any user (anonymous,
     free, Hobby, Pro) may paste a provider key (Anthropic / OpenAI /
     Google / OpenRouter / future providers) into their account. When
     present, the router dispatches through their key with **0%
     markup, 0 platform fees** — we never touch the provider's
     invoice. Implemented in
     [`SK-LLM-016`](../features/llm-router/FEATURE.md). The key lives
     encrypted-at-rest in `api_keys` (scope `byollm`); see
     [`SK-PREMIUM-008`](../features/premium-tier/FEATURE.md) for
     storage, revocation, and failure-mode contract.
  3. **Hosted premium router — paid plans only, charged by usage.**
     On Hobby and Pro, the router gains a "premium" path
     (Claude Sonnet 4.6 / GPT-5 / Gemini 2.5 Pro class) selected by
     the existing tier-aware policy. Premium usage is billed via
     Stripe metered subscription items at **provider list price +
     0% markup, with no included allowance** — first token costs
     real money, charged at month-end. Implemented in
     [`SK-LLM-017`](../features/llm-router/FEATURE.md) and
     [`SK-PREMIUM-009`](../features/premium-tier/FEATURE.md). Premium
     dispatch is **gated** behind the existing
     [`phase-plan.md` §6](../phase-plan.md) monetization trigger —
     the architectural slot exists from day one but the meter does
     not fire until Stripe live ships.

  Dispatch precedence inside the router, highest → lowest:

  1. Per-request override (`x-nlq-byollm-key` header, signed-in only).
  2. Account-stored BYOLLM key (`api_keys.scope = "byollm"`).
  3. Hosted premium router (only if `principal.tier !== "free"` AND
     the §6 trigger has tripped).
  4. Free LLM router (the strict-$0 chain — always available).

- **Core value:** Free, Honest latency, Tax-free integration
- **Why:**
  - **The asymmetric bet.** Optimizing the engine on free LLMs is a
    forcing function: the scaffolding (planner, validator, plan-cache,
    schema retrieval, few-shot, trust UX) has to do the heavy lifting
    when the model can't. When a frontier model later runs the same
    pipeline, every percentage point of accuracy our scaffolding earned
    *compounds with* the model's capability. The Spider 2.0 frontier
    in 2026 is 5.68% (DAIL-SQL + GPT-4o) to 23.77% (o3-mini) — proof
    that engine work, not model picking, is the moat (see
    [`research-receipts.md`](../research-receipts.md)). This is the
    "great on free LLMs ⇒ invincible on frontier LLMs" thesis from
    [`GLOBAL-025`](./GLOBAL-025-north-star.md).
  - **AI economics are not SaaS economics.** Every premium-model
    request has a marginal cost ($0.10–$30 per million tokens; 600×
    spread between cheapest and most expensive in 2026). Pure flat
    pricing on premium routing bleeds margin (Bessemer "AI Pricing
    Playbook" 2026: 50–60% AI gross margin vs 80–90% classic SaaS).
    Pure usage causes revenue volatility and "unexpected bill"
    complaints (78% of IT leaders in 2026; Flexprice survey). **The
    Bessemer-recommended hybrid for AI startups is flat subscription
    + metered LLM overage** — adopted here as Hobby/Pro
    (features) + per-token premium (compute pass-through).
  - **0% markup is non-negotiable.** Vercel AI Gateway shipped at
    zero markup in May 2026; OpenRouter dropped BYOK markup to 0%
    for the first 1M requests in response. Charging more than
    provider list is no longer competitive — it is also off-brand
    for a tool whose pitch is "no hidden surface area".
  - **BYOLLM is a product, not an opt-out.** Heavy users who
    self-fund frontier models are the people most likely to bring
    the engine to its limits — they generate the eval signal that
    drives the free chain forward. BYOLLM keeps them inside the
    product instead of building their own.
  - **Free-tier never sees premium.** Honoring strict-$0 forever for
    the free tier means we cannot ship "premium for free" promotions
    without breaking
    [`GLOBAL-013`](./GLOBAL-013-free-tier-bundle-budget.md). The
    BYOLLM lane is how free-tier users access premium — by paying
    their own provider directly.
- **Consequence in code:**
  - `packages/llm/src/router.ts` adds the four-step dispatch
    precedence above. Existing `chain.ts` covers step 4; new
    `byollm-dispatch.ts` covers steps 1–2; new `premium-chain.ts`
    covers step 3.
  - `packages/llm/src/providers/` gains Anthropic + OpenAI + Gemini-Pro
    provider modules (zero-runtime-cost when never instantiated).
  - `apps/api/migrations/<next>_byollm_keys.sql` adds
    `api_keys.scope = "byollm"` semantics. Encryption envelope and
    revocation are inherited from
    [`api-keys`](../features/api-keys/FEATURE.md).
  - Stripe metered subscription items: a new
    `nlqdb.premium_llm.tokens` SKU per provider, billed at provider
    list price. Implementation deferred to
    [`stripe-billing`](../features/stripe-billing/FEATURE.md) and
    gated on the [`phase-plan.md` §6](../phase-plan.md) trigger.
  - OTel spans per [`GLOBAL-014`](./GLOBAL-014-otel-on-external-calls.md):
    `llm.provider`, `llm.dispatch_lane` (`free` | `byollm` | `premium`),
    `llm.billed_to` (`platform` | `byollm` | `metered`).
  - `principal.dispatch_lane` flows through the rate-limit middleware
    so per-lane abuse policies are sane (per
    [`rate-limit/FEATURE.md`](../features/rate-limit/FEATURE.md)).
- **Alternatives rejected:**
  - **Pure flat ("Hobby $10 = unlimited premium")** — bleeds margin
    on heavy users; can't sustain Sonnet 4.6 at $25/mo retail.
  - **Pure usage (no subscription, all tokens metered)** — revenue
    volatility, no feature-gating handle, scares predictable-bill
    buyers. 78% of buyers report unexpected-bill pain in 2026.
  - **Subscription with included premium-LLM allowance ("Hobby = $10
    + $5 of premium credit included")** — Bessemer's hybrid form,
    but adds two complications: (a) allowance denomination (dollars?
    tokens? requests?) churns as provider prices move; (b) "did my
    free credit run out?" is the worst UX moment in a metered
    product. Pure-overage from the first token, in a tier the user
    already paid to enter, is cleaner.
  - **BYOLLM paid-tier-only** — leaves the heaviest free-tier
    abusers no escape valve; they hit the global cap, churn, and we
    never see their eval signal.
  - **>0% markup on BYOLLM or premium** — uncompetitive vs Vercel
    AI Gateway and OpenRouter post-2026; corrodes the "no hidden
    surface area" pitch.
  - **Defer the architectural decision until §6 trips** — the
    routing precedence affects the schema (`api_keys.scope`) and
    span names; deciding it now lets BYOLLM ship in Phase 2 alongside
    the eval harness, with hosted premium "wired but dark" until §6.
  - **Use OpenRouter exclusively as the premium path** — couples
    our reliability to a single broker; loses the per-provider
    failover that the strict-$0 chain depends on.

## Reconciliation with existing decisions

- [`GLOBAL-013`](./GLOBAL-013-free-tier-bundle-budget.md) — **strict-$0
  for the free tier is permanent**, not "through Phase 1". This
  GLOBAL clarifies: the free tier *never* gets hosted premium; if
  free-tier users want premium accuracy, BYOLLM is the path.
  Bundle-size budget unchanged.
- [`phase-plan.md` §6](../phase-plan.md) — Stripe live is still
  demand-signal-gated. This GLOBAL adds: BYOLLM can ship **before**
  §6 trips (no payment infra needed), and the architectural slot
  for premium dispatch lands now so flipping it on at §6 is a
  feature-flag change, not a refactor.
- [`SK-LLM-003`](../features/llm-router/FEATURE.md) — the free
  chain shape is unchanged; this GLOBAL adds two new dispatch
  lanes above it.
- The prior `premium-tier/FEATURE.md` "BYOK — decision tree" Open
  question (no SK-ID yet; the reserved slot was `SK-PREMIUM-008`)
  is **resolved** by `SK-PREMIUM-008` here. The prior "no BYOK in
  v1" stance is reversed.
