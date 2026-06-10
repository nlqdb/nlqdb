# SK-STRIPE-010 — Checkout refuses a caller who already holds a live subscription; tier changes go through the Portal

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md). The Portal path
this defers tier changes to is `SK-STRIPE-008`; the shared status read is
`SK-STRIPE-009`.

- **Decision:** `POST /v1/billing/checkout` reads `customers.status` first and returns `409 already_subscribed` unless the row is absent or in a Stripe *terminal* status (`canceled` / `incomplete_expired`). Every other status — incl. `incomplete` (first invoice payable 23h), `unpaid`, `paused` — keeps a live subscription, so the caller switches tier in the Portal (SK-STRIPE-008), where Stripe prorates; `/pricing` mirrors it (non-current paid CTA → "Switch plan" → Portal, 409 as the backstop).
- **Core value:** Bullet-proof, Honest latency
- **Why:** A second `mode: 'subscription'` Checkout opens a parallel Stripe customer + subscription and double-bills — a "surprise bill" `billing-philosophy.md` forbids. The guard fails safe: any non-terminal (incl. unrecognized future) status blocks.
- **Consequence in code:** `blocksNewCheckout(status)` + `CHECKOUT_REOPEN_STATUSES` in `stripe/billing-status.ts` (pure, unit-tested); the route owns the one-row D1 read; no Stripe call on reject.
- **Alternatives rejected:** Allowlist the *blocking* statuses — a new Stripe status would default to "allow" and double-bill. Reconcile later — refunds + support for a self-inflicted defect.
