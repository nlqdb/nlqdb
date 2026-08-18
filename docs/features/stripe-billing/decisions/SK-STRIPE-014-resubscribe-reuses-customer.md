# SK-STRIPE-014 — Re-subscribe reuses the existing Stripe customer instead of minting a new one

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md). This is the
re-subscribe path of Checkout; the duplicate-subscription guard it clears is
`SK-STRIPE-010` and the customer-linkage contract is `SK-STRIPE-004`.

- **Decision:** When the checkout route runs against an existing `customers` row (only reachable on the re-subscribe path — a terminal `canceled` / `incomplete_expired` status survived the SK-STRIPE-010 guard), it passes that row's `stripe_customer_id` to the Checkout Session as `customer` and drops `customer_email`. With an existing customer + `automatic_tax`, the session also sets `customer_update: { address: 'auto' }` so the address collected at checkout is written back for tax. A first-time subscriber (no row) is unchanged: `customer_email` prefill, no `customer`.
- **Core value:** Bullet-proof, Honest latency
- **Why:** In `mode: 'subscription'`, Stripe mints a brand-new Customer object when no `customer` is supplied. A canceled user who re-subscribes would get a second Stripe customer, orphaning their invoice history, saved cards, and tax IDs; the `customers` row (keyed by `user_id`) would then point at the new customer and silently strand the old one. Reusing the customer keeps one billing identity per user.
- **Consequence in code:** `CheckoutDeps` gains `existingStripeCustomerId`; the route widens its existing duplicate-guard read to `SELECT status, stripe_customer_id` (no extra query) and passes the id through. Stripe forbids `customer` + `customer_email` together, so the params builder picks exactly one. The webhook is unaffected — `checkout.session.completed` upserts the same `stripe_customer_id` for the same `user_id`.
- **Alternatives rejected:**
  - Always pass `customer_email`, never `customer` — orphans a Stripe customer on every re-subscribe; the data-integrity bug this fixes.
  - Reconcile/merge duplicate Stripe customers after the fact — Stripe has no customer-merge API; prevention at Checkout time is the only clean path.
