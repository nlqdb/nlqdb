# SK-STRIPE-016 — Subscription events write only to the current subscription; `canceled` is final

Parent feature: [`stripe-billing/FEATURE.md`](../FEATURE.md). Extends the
order-independence of `SK-STRIPE-012` from row creation to every
`customer.subscription.*` write.

- **Decision:** `created`, `updated` and `deleted` all write through `syncSubscriptionFields`, whose `UPDATE` carries one guard: write when the event is for the row's `stripe_subscription_id` and that subscription is not yet terminal (`canceled`, `incomplete_expired`), or when the event brings a different subscription to a row whose subscription is absent or terminal. `deleted` writes `status = 'canceled'` through the same guard. `upsertCustomerLink`'s `ON CONFLICT` keeps `status` while the subscription id is unchanged and resets it to `incomplete` when a re-subscribe links a new id. A write the guard refuses logs `subscription_event_superseded` (info) and is otherwise a no-op; the `billing.subscription_*` emits are unchanged (deduped per `sub.id`).
- **Core value:** Bullet-proof
- **Why:** Stripe doesn't guarantee webhook order ([docs](https://docs.stripe.com/webhooks#event-ordering)), and a `canceled` subscription "is a terminal state that can't be updated" ([docs](https://docs.stripe.com/billing/subscriptions/overview#subscription-statuses)); re-subscribing creates a new subscription. The old unguarded write let a late `updated` set a canceled customer back to `active` (so Checkout refused them with `409 already_subscribed`, `SK-STRIPE-010`, and a premium lane would be free), and a late `deleted` for an old subscription cancel the new paid one. Reported externally against `cfce5c8`.
- **Consequence in code:** The guard is one SQL predicate (`SUBSCRIPTION_WRITE_GUARD` in `apps/api/src/stripe/webhook.ts`), so the check and the write are one atomic statement — safe under parallel-Worker delivery. No Stripe API read, no event-timestamp ordering (Stripe: `created` is second-granular and not an ordering key), no schema change. `apps/api/test/stripe-webhook-order.test.ts` replays the out-of-order sequences on the real migrations (in-memory SQLite).
- **Alternatives rejected:**
  - Re-read the subscription from Stripe before each write — an outbound call on every event, and a Stripe outage would drop the update for good, since a dispatch failure returns 200 and is never retried (`SK-STRIPE-003`).
  - Order by `event.created` in a new column — needs a migration, and Stripe documents `created` as unfit for ordering.
