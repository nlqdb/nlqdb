# SK-PREMIUM-006 — Per-key spend cap is mandatory; default 100% hard at sign-up; one-click extension

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Sibling of
[`SK-PREMIUM-009`](./SK-PREMIUM-009-hosted-premium-meter.md) and
[`SK-PREMIUM-011`](./SK-PREMIUM-011-overflow-policy.md).

- **Decision:** Every `(DB, API key)` pair with premium enabled carries a
  monthly spend cap denominated in USD. Default cap on opt-in is the
  user-set monthly budget (defaults to **$10/key/mo**); soft cap fires
  at 80% (email warning); hard cap defaults to 100% — the router falls
  through to the strict-$0 chain and emits
  `nlqdb.premium.hard_cap_hit.total{customer_id, db_id, key_id}`. Hard-
  cap extension is one click in the dashboard, generates an email
  confirmation, and applies for the remainder of the billing period only
  (resets next period). Cap can be raised via API but never silently —
  every change emits `billing.premium_cap_changed` to LogSnag.

- **Core value:** Bullet-proof, Honest latency

- **Why:** Pay-per-token without a cap is the runaway-bill story that
  breaks the "no surprise $4,000 bills. Ever." promise in
  `docs/architecture.md §5`. A cap that defaults to "off" or to a high
  number is the same risk re-shaped. Hard-falling-through to the
  strict-$0 chain at 100% (instead of 4xx-erroring) is the consequence
  of the goal-first stance in `SK-PREMIUM-003` — the user gets *an*
  answer, just not the frontier-model one. The 30-day extension reset
  prevents drift toward "everyone has $1k caps after a year." Under
  `SK-PREMIUM-009`'s Shape-B (allowance + overage), the cap applies to
  **overage spend after allowance exhaustion**; included-allowance
  requests are free at the meter and never tick the cap.

- **Consequence in code:** `apps/api/src/billing/premium/cap.ts` enforces
  the cap inline in the `/v1/ask` pipeline before the LLM router is
  invoked; over-cap requests rewrite the chain selector to `free` and
  add a `cap_hit: true` field to the response trace. The KV-cached
  lookup from `SK-PREMIUM-001` carries `cap_usd_cents` and
  `period_spent_cents`; `period_spent_cents` increments via the
  metering write from `SK-PREMIUM-002` (with `ctx.waitUntil`). Extension
  endpoint is `POST /v1/billing/premium/cap/extend { db_id, key_id,
  new_cap_usd }` with `Idempotency-Key` per `GLOBAL-005`. Telemetry:
  `nlqdb.premium.spend_usd_cents{customer_id, db_id, key_id, period}`
  gauge + `nlqdb.premium.cap_hit.total` counter (cardinality budget per
  `docs/performance.md §3.3`).

- **Alternatives rejected:**
  - 4xx error at hard cap — strands the user mid-task with no answer;
    the goal-first stance prefers a graceful chain fallback.
  - Soft cap only (warn but never stop) — produces the runaway bill in
    the worst case; rejected for the pricing-honesty stance.
  - Cap denominated in tokens not USD — token prices change; USD is the
    unit the user commits to. Internal accounting can use tokens; the
    user-facing cap is dollars.
  - Account-level cap instead of per-key — collides with `SK-PREMIUM-001`'s
    per-(DB, key) granularity; a per-key cap is the smaller blast radius.

- **Source:** docs/architecture.md §5 (honest billing rules) ·
  docs/architecture.md §6 (per-key spend cap) · `docs/features/rate-
  limit/FEATURE.md` (open: spend cap)
