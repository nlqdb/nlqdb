# SK-PREMIUM-009 — Hosted-premium meter: flat sub + included monthly request allowance + soft-meter overage at provider list + 0% markup, §6-gated

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Parent GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** When [`phase-plan.md §6`](../../../phase-plan.md) trips and
  Stripe live ships, paid plans gain the **hosted-premium dispatch lane**
  per `GLOBAL-026`, with **flat subscription + included monthly request
  allowance + soft-meter overage**.
  - **Hobby $10/mo:** features + ~200 included premium queries/mo (target
    — calibrate against the `nlqdb.premium.cost_per_query_usd` histogram
    per `SK-PREMIUM-010`, tbd-by-2026-08-15).
  - **Pro $25/mo:** features + ~600 included premium queries/mo (same
    calibration cadence).
  - **Allowance unit = requests/queries**, not dollars or tokens. Unit is
    stable across provider price moves; matches user intuition ("I asked
    5 questions").
  - **Per-query soft cap + hard ceiling per `SK-PREMIUM-010`** prevent a
    single monster query from exhausting the allowance.
  - **No carryover** — unused requests expire at end of billing period.
    Matches Vercel AI Gateway / Cursor / v0; simplest accounting; no
    stockpile-then-cancel abuse vector.
  - **Soft-meter overage per `SK-PREMIUM-011`** at provider list + 0%
    markup — when allowance is exhausted, premium queries continue and
    bill as metered overage line items by default. Per-account opt-in to
    "fall back to free chain at exhaustion" (no extra charge, surfaced
    in trace) for budget-conscious users.
  - **Per-key spend cap from `SK-PREMIUM-006`** (default $10/key/mo,
    user-adjustable) is the absolute ceiling on overage spend.
  - Pre-§6: lane feature-flagged dark per `GLOBAL-026`.

- **Core value:** Free, Honest latency, Effortless UX

- **Why:**
  - **Bessemer's hybrid is the recommended shape for AI startups.** Flat
    subscription pays for features + baseline allowance; meter handles
    overage. Captures both predictable-bill buyers and pay-for-what-you-use
    buyers in one SKU.
  - **Soft-landing matters more than pure-meter purity.** A user who
    paid $10 wants to try premium without billing on the first token.
    Included allowance is the affordance that closes the "I paid, now
    I owe more?" gap that pure-metered Shape-A leaves open.
  - **Requests-as-unit is the only stable allowance unit.** Dollar-
    denominated drifts as provider prices fall (LLM token prices dropped
    ~80% in 2026; an allowance "$5" means 5× more tokens in 12 months,
    forcing silent drift or quarterly re-spec). Tokens are opaque to
    buyers and vary per-model. One query = one query stays meaningful.
  - **No carryover keeps accounting trivial.** Carryover invites
    downgrade/cancel edge cases and stockpile abuse; renewal-aligned
    reset matches the subscription mental model.
  - **Soft-meter default preserves UX continuity at the boundary.** Hard-
    stop is jarring; opt-in fallback (`SK-PREMIUM-011`) is the user-chosen
    "no surprises" path. Default soft-meter respects flow; cap from
    `SK-PREMIUM-006` is the absolute ceiling.
  - **§6-gated meter, not §6-gated architecture** — router precedence,
    schema, Stripe SKU shape, OTel attributes all land in Phase 2;
    lighting the lane is a feature-flag flip.

- **Consequence in code:**
  - D1 schema: `premium_allowance_period (customer_id, period_start,
    plan_tier, allowance_total_requests, allowance_consumed_requests,
    overflow_policy, updated_at)` — refreshed on each premium call before
    dispatch.
  - Stripe metered subscription items for overage:
    `nlqdb.premium_llm.overage.<provider>.<model>` created lazily on
    first overage post-allowance-exhaustion. Per-call USD cost computed
    from `packages/llm/src/pricing.ts` per `SK-PREMIUM-002`.
  - Per-(customer, period) gauges: `nlqdb.premium.allowance_consumed`
    and `nlqdb.premium.allowance_remaining`.
  - `/v1/ask` response trace surfaces "This request used 1 of your 200
    included premium requests" (pre-exhaustion) or "This request billed
    $0.03 on overage" (post-exhaustion) per `GLOBAL-011` (honest
    latency).
  - Feature flag `PREMIUM_METER_LIVE` (Workers Secret) gates dispatch.
  - Chat-surface upgrade-CTA from `SK-PREMIUM-004` surfaces the boundary
    explicitly so users at the allowance edge see "your next query will
    [meter at $0.03 / route to free chain]" before sending.

- **Alternatives rejected:**
  - **Pure-metered with no allowance (the prior shape of this SK).**
    First-token friction on the paid tier; users primed by Cursor / v0
    expect bundled quota. Discarded after Shape B review.
  - **Pure usage (no flat subscription)** — Flexprice 2026 survey: 78%
    of buyers report unexpected-bill pain. Loses subscription anchor;
    Hobby/Pro feature-gating handle disappears.
  - **Dollar-denominated allowance ($5 / $15 of credit)** — Bessemer's
    canonical hybrid form, but allowance churns with provider prices
    (silent drift or quarterly re-spec). Worst-case dishonest at
    customer-experience scale.
  - **Token-denominated allowance** — opaque unit for buyers; different
    models cost different per-token; we'd have to invent a "normalized
    token" fiction.
  - **Carryover with cap (1-month, 2× monthly allowance)** — accounting
    complexity around downgrade/cancel mid-period; abuse vector
    (stockpile months then cancel).
  - **Hard-stop at allowance exhaustion (default).** Jarring boundary;
    available as an effect of opt-in via spend cap + fallback policy,
    not as the default.
  - **Silent fallback to free chain by default.** Dishonest (user paid
    for premium routing, got free, no notification); violates
    `GLOBAL-023` (trust UX baseline). Available as opt-in via
    `SK-PREMIUM-011`, not default.
  - **Third "Premium" tier with included quota (Hobby/Pro/Pro+).** Adds
    a SKU pre-PMF; same allowance-denomination problem the SKU-defining
    quota would force; Hobby/Pro feel second-class on premium routing.
  - **Light the meter without §6** — premature payment infra; violates
    "pay only when someone pays you".
