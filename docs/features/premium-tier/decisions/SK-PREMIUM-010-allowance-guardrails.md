# SK-PREMIUM-010 — Allowance guardrails: per-query soft cap, hard ceiling, cost-per-query instrumentation

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Sibling of
[`SK-PREMIUM-009`](./SK-PREMIUM-009-hosted-premium-meter.md). Parent
GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** The included request allowance from `SK-PREMIUM-009` is
  protected by three guardrails so a single oversize query can't blow
  through a month's allowance and so the request-count calibration has a
  real distribution behind it.
  1. **Per-query soft cap** — target ≈ 50k tokens (input + output) per
     "standard" premium query. Queries above the soft cap count as
     multiple allowance slots: ceiling(`tokens / soft_cap_tokens`) slots
     per call. Soft-cap value and slot-count rounding are
     `tbd-by-2026-08-15` after instrumentation lands.
  2. **Per-query hard ceiling** — target ≈ 500k tokens. Above the ceiling
     the request is refused with a one-sentence error per `GLOBAL-012`
     and the next action ("split your question, or use BYOLLM with a
     long-context model"). Hard ceiling creates a predictable maximum
     cost per call and prevents a context-leak from wiping the
     allowance.
  3. **Cost-per-query instrumentation** ships *first* — `nlqdb.premium.
     cost_per_query_usd{provider, model, sized}` histogram (sized
     buckets: `standard | large | refused`) plus
     `nlqdb.premium.tokens_per_query` histogram. The allowance counts
     (`SK-PREMIUM-009`'s 200 Hobby / 600 Pro) are calibrated against
     `p50_cost_per_query × allowance_count ≤ tier_price × (1 - target_
     gross_margin)`. Target gross margin ≥ 60% post-COGS per Bessemer's
     AI-margin band.

- **Core value:** Bullet-proof, Free, Honest latency

- **Why:**
  - **A single 1M-token query could blow through a $25/mo tier in one
    call.** Sonnet 4.6 at ~$3/M input + $15/M output: 1M-token request =
    $3–15. Without a per-query cap, allowance economics fail in the long
    tail. With one, the tail is bounded and predictable.
  - **Requests-as-unit only works when query size is bounded.** If a
    "query" can be 100× the average, "200 queries/mo" loses meaning for
    cost prediction. The soft-cap-as-slot-multiplier is the bridge —
    requests are still the user-facing unit, but the meter accounts for
    real cost.
  - **Calibrate from data, not guesses.** Pre-launch we don't know the
    cost distribution on real `db.create` schemas. Instrumentation must
    land 6+ weeks before tier-launch so the 200/600 counts are anchored
    in a measured `p50`, not a guess.
  - **Refusing oversize queries is honest.** "This question is too large
    for the included tier — use BYOLLM with a long-context model, or
    split it" is a one-sentence error per `GLOBAL-012`. Silent overage
    on a 500k-token monster would be a surprise bill.

- **Consequence in code:**
  - `apps/api/src/billing/premium/guardrails.ts` enforces (1) and (2)
    before LLM dispatch. (2)'s refusal returns 413 with
    `{ error: "query_too_large", max_tokens, suggested_action }`.
  - `packages/llm/src/router.ts` emits `nlqdb.premium.cost_per_query_usd`
    and `nlqdb.premium.tokens_per_query` after every premium call (free-
    chain and BYOLLM lanes excluded — only hosted-premium feeds the
    calibration).
  - Cap numbers live in `apps/api/src/billing/premium/limits.ts` as a
    single table per tier; PR-reviewed changes only, with a CHANGELOG
    entry on every numeric move per `SK-PREMIUM-002` precedent.
  - Calibration deadline: instrumentation lands by **2026-07-01**;
    allowance counts calibrated by **2026-08-15** (6 weeks of baseline
    distribution).
  - "Standard" vs "large" definitions surface in `/v1/ask` response
    trace ("this query consumed 2 of your premium request slots") and
    in pricing-page docs.

- **Alternatives rejected:**
  - **No per-query cap, hope-and-pray distribution.** Long-tail token
    usage is fat enough to wipe out unit economics; first incident is
    too late to add a cap.
  - **Per-query cap denominated in dollars.** Same provider-price churn
    as a dollar-denominated allowance.
  - **Charge oversize queries the overage rate without a hard ceiling.**
    Loses the "predictable maximum cost per call" promise; surprises
    happen at the boundary.
  - **Hard-refuse at the soft cap.** Too aggressive; users with a
    legitimate large query should pay slot-cost, not get refused.
  - **Calibrate allowance counts before instrumentation lands.** Same
    failure mode as committing pricing without COGS data — first month
    of paid customers is too narrow a base to redo the calibration on.
