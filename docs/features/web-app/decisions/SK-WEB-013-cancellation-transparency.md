# SK-WEB-013 — `/pricing` surfaces a scheduled cancellation; the current-tier CTA becomes one-click "Resubscribe"

Body shard of [`web-app/FEATURE.md`](../FEATURE.md) (the FEATURE is over the
20 KB cap, so new decision bodies live beside it — same pattern as
`stripe-billing/decisions/`). Summary line lives in FEATURE.md under
`## Decisions`.

- **Decision:** When `GET /v1/billing/status` (SK-STRIPE-009) reports
  `cancelAtPeriodEnd`, the `/pricing` current-plan badge reads *"Ends {date}"*
  — `currentPeriodEnd` formatted by `formatPlanEndDate` in
  `apps/web/src/lib/billing.ts` — instead of "Current plan", and that tier's
  CTA stays live as **"Resubscribe"**, routed through the Billing Portal
  (reusing the existing `data-switch` → `openBillingPortal` path), where Stripe
  un-cancels. No new endpoint, Stripe call, or env var: it reads state the
  webhook already persists (`customers.cancel_at_period_end` /
  `current_period_end`).
- **Core value:** Honest latency, Effortless UX
- **Why:** A cancelled-but-still-active subscriber (Stripe keeps `status` at
  `active` until period end) otherwise sees a plain "Current plan" with no hint
  their access lapses on a date they chose — the silent-lapse dark pattern the
  honest-billing rules forbid (`billing-philosophy.md`). Naming the end date and
  keeping the one-click un-cancel path turns a pending churn into a recoverable
  one, without ever starting a second Checkout.
- **Consequence in code:** `formatPlanEndDate` (unix-seconds → locale date,
  `null` on absent/non-finite/unparseable input) is unit-tested in
  `lib/billing.test.ts`; the `.pricing__badge--ending` variant is a neutral
  outline (the user's own choice ending, not an error, so it must not borrow the
  danger tone). The CTA reuses the portal route, so SK-STRIPE-010's
  no-double-bill guard still holds — a stale "Resubscribe" click that reaches a
  live subscription is prorated by Stripe, never double-billed.
- **Alternatives rejected:**
  - Disable the current-tier CTA as "Current plan" regardless of cancel state —
    hides the one action (resubscribe) the user most likely wants and stays
    silent on the lapse.
  - Surface the end date on `/app` too in this slice — the current-plan badge
    lives on `/pricing`; the `/app` banner (SK-WEB-012) owns the live
    `past_due`/`unpaid` failure state, a separate signal. A scheduled
    cancellation is not a failure.
