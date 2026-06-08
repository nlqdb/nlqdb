# SK-STRIPE-011 — `invoice.payment_failed` emits a per-invoice operator dunning alert; no DB write

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md). The in-app
banner half is web-app `SK-WEB-012`; the subscription status this relies on
is synced by `SK-STRIPE-005`.

- **Decision:** The webhook handles `invoice.payment_failed` by emitting `billing.payment_failed` (user resolved from `invoice.customer` only — `customer` stays a top-level string after Basil relocated `invoice.subscription` to `parent.subscription_details`), deduped per `invoice.id` so Stripe's automatic dunning retries collapse to one alert. It writes **nothing** to `customers`: the subscription's `past_due`/`unpaid` status is already synced by `customer.subscription.updated` (SK-STRIPE-005), which drives the in-app banner (web-app `SK-WEB-012`). No customer-facing email yet — that half stays open.
- **Core value:** Bullet-proof, Honest latency
- **Why:** An at-risk subscription is the highest-value billing signal a pre-revenue founder can get — involuntary churn is recoverable if you reach out before Stripe exhausts its retries. The signal is actionable and low-volume (one invoice per customer per period), so it earns `notify: true` without the quota risk SK-STRIPE-005 guards against; per-invoice dedup keeps the ~4 dunning retries from re-paging.
- **Consequence in code:** New `handleInvoicePaymentFailed` branch in `dispatchEvent`; resolution shares `lookupUserByCustomer` with `resolveSubUser`. The `billing.payment_failed` variant lands in `packages/events/src/types.ts`, the LogSnag `billing`-channel mapping in `apps/events-worker/src/sinks/logsnag.ts`, and the per-invoice default-id in `packages/events/src/index.ts` (GLOBAL-003 four-place sync). No new env var, no schema change.
- **Alternatives rejected:**
  - Notify on every retry attempt — burns the quota and re-pages on the same at-risk invoice with no new information.
  - Persist a `payment_failed` flag on `customers` — duplicates the `past_due` status the subscription sync already owns; two sources of truth drift.
  - Block until the customer-email path exists — the operator alert is independently valuable and ships the producer half now; the email is additive.
