# SK-PREMIUM-011 — Allowance exhaustion: soft-meter overage by default, opt-in fallback to free chain

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Sibling of
[`SK-PREMIUM-009`](./SK-PREMIUM-009-hosted-premium-meter.md). Parent
GLOBAL:
[`GLOBAL-026`](../../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md).

- **Decision:** When a customer exhausts their monthly included premium-
  request allowance from `SK-PREMIUM-009`, behavior is determined by a
  per-account preference `users.overflow_policy ∈ {"meter", "fallback"}`,
  default `"meter"`.
  - **`overflow_policy = "meter"` (default):** Premium queries continue.
    Each call bills as metered overage at provider list + 0% markup. The
    per-key spend cap from `SK-PREMIUM-006` is the absolute ceiling on
    overage spend.
  - **`overflow_policy = "fallback"` (opt-in):** Premium queries continue
    but route to the **free chain** (Cerebras / Groq / Gemini Flash /
    OpenRouter free) for the remainder of the billing period. No extra
    charge. Trace surfaces `overflow_fallback: true` so the user sees
    the routing change explicitly. Resets at next period boundary along
    with the allowance.
  - Per-key spend cap from `SK-PREMIUM-006` is the hard ceiling
    regardless of policy. When the cap is hit on `meter`, falls through
    to free chain (consistent with `SK-PREMIUM-006`'s default).
  - Preference toggles in the dashboard (`apps/web/src/pages/app/billing
    .astro`) with one click. Toggling mid-period takes effect on the
    next premium query.
  - The chat-surface upgrade-CTA from `SK-PREMIUM-004` surfaces the
    policy explicitly at the allowance boundary: "your next query will
    [meter at $0.03 / route to free chain]" before sending.

- **Core value:** Effortless UX, Honest latency, Bullet-proof

- **Why:**
  - **Soft-meter default matches Bessemer's hybrid recommendation.**
    Most paid users tolerate predictable, capped overage if it preserves
    flow; the hard-stop alternative interrupts a workflow mid-task.
  - **Opt-in fallback is the budget-conscious escape.** Some users
    explicitly want "no surprise bills, fall back to free if quota's
    gone." Opt-in honors that without dishonest silent downgrade.
  - **Silent fallback to free by default would be dishonest** — user
    paid for premium, got free with no signal. `GLOBAL-023` (trust-ux
    baseline) explicitly rejects that pattern. Opt-in inverts the
    consent: the user chose this routing.
  - **Predictable maximum bill** = subscription baseline + (per-key
    spend cap × keys). User sees one number on their billing page, not
    "depends on usage."
  - **Per-period preference, not per-query.** Avoids the "did my last
    query bill or fall back?" ambiguity — the entire period is one
    mode. Aligns with `GLOBAL-017` (one way to do each thing).

- **Consequence in code:**
  - `apps/api/src/billing/premium/overflow.ts` checks
    `users.overflow_policy` and `allowance_remaining` before LLM
    dispatch; routes to `premium-chain.ts` (with overage meter wired)
    or `chain.ts` (free) accordingly.
  - D1 migration: `users.overflow_policy TEXT NOT NULL DEFAULT 'meter'
    CHECK (overflow_policy IN ('meter', 'fallback'))`.
  - Dashboard surface in `apps/web/src/pages/app/billing.astro` — one
    toggle with copy "When you exhaust your monthly allowance: [meter
    overage at provider list / fall back to free chain]."
  - OTel: `llm.overflow_policy` attribute on every premium-LLM span;
    counter `nlqdb.premium.overflow_fallback_events.total`.
  - SDK exposes the current policy at `GET /v1/billing/me`; CLI:
    `nlq billing show`. Updates via
    `PATCH /v1/billing/overflow_policy { policy }` with `Idempotency-Key`
    per `GLOBAL-005`.
  - The "switched to free chain" trace surface must satisfy
    `GLOBAL-023`: a banner on the chat surface and a flag in the SDK
    trace block — not silent.

- **Alternatives rejected:**
  - **Hard-stop at allowance exhaustion (default).** Jarring boundary;
    forces user into a purchase decision mid-workflow. Spend cap
    (`SK-PREMIUM-006`) is the right hard-stop locus, not the allowance.
  - **Silent fallback to free chain (default).** Dishonest — user paid
    for premium routing and would get free without notification. Violates
    `GLOBAL-023`.
  - **Per-query policy** (e.g. `x-nlq-overflow: meter|fallback` header).
    Adds a third overlapping knob with the model preset
    (`SK-PREMIUM-003`); collapsed into a per-account preference for
    simplicity per `GLOBAL-017`.
  - **Auto-degrade to a smaller premium model at exhaustion** (Sonnet →
    Haiku-class). Creates an implicit mid-tier we'd have to price; loses
    the "this *is* premium" identity.
  - **Period-end backstop fee in lieu of overage** — same accounting
    surface as a metered SKU plus an extra special-case branch.
