# SK-PREMIUM-017 — Overage metering rides Stripe Billing Meters directly (no Lago), idempotent events + daily reconciliation

Parent feature: [`premium-tier/FEATURE.md`](../FEATURE.md). Refines
[`SK-PREMIUM-002`](./SK-PREMIUM-002-provider-list-zero-markup.md) and supersedes
its Lago mention.

- **Decision:** Hosted-premium overage is metered to **Stripe Billing Meters**
  directly — the Lago-on-Fly usage-metering layer named in
  [`phase-plan.md §6`](../../../phase-plan.md) is **not built**. Three rules:
  1. **Async, never blocking.** The meter event is reported after the `/v1/ask`
     response ships (`ctx.waitUntil`). Allowance decrement + cost + the trace
     line are computed synchronously (one batched D1 write) so the response is
     honest; only the Stripe round-trip is deferred.
  2. **Idempotent event ids.** Each overage event id is
     `premium:<customer>:<request-key>` (the request's `Idempotency-Key`, or a
     stable request id). It's the PK of the internal ledger
     (`premium_meter_events`) AND the Stripe `identifier`, so a retried request
     double-bills on neither side. Stripe is reported only on the ledger's
     first insert (dispatch-after-insert, `SK-STRIPE-002` pattern).
  3. **Daily reconciliation.** A daily cron job
     (`apps/api/src/billing/premium/reconcile.ts`) sums the ledger and compares
     against Stripe's per-customer meter summaries, recording drift on
     `nlqdb.premium.meter_reconcile_drift_usd_cents`. It also surfaces stuck
     (`pending`/`error`) ledger rows with no Stripe read required.

- **Core value:** Bullet-proof, Honest latency, Simple

- **Why:** Lago is an extra hosted service and a second reconciliation surface
  to run for a v1 single-provider meter that Stripe Billing Meters aggregate
  natively (`GLOBAL-016` — reach for the mature primitive before DIY infra).
  Doing it in-Worker keeps the cost ladder flat ("pay only when someone pays
  you") — the meter fires no external billing infra until `PREMIUM_METER_LIVE`
  is flipped. Idempotent ids make the async report safe to retry, and the daily
  reconciliation is the honest-billing backstop: a dropped or double report
  surfaces on a dashboard, not on a customer's invoice.

- **Consequence in code:** `apps/api/src/billing/premium/meter.ts` (ledger +
  Stripe report), `reconcile.ts` (daily cron), `apps/api/migrations/0031_premium_meter.sql`
  (`premium_meter_events`). Dark until `PREMIUM_METER_LIVE` + `STRIPE_PREMIUM_METER_ID`
  are set (blocked-by-human). The `phase-plan.md §6` "Lago metering" gate is
  restated as "Stripe Billing Meters".

- **Alternatives rejected:**
  - **Lago-on-Fly** — the prior plan; extra infra + sync surface for no v1 gain (superseded).
  - **Synchronous meter report** — a Stripe round-trip on the `/v1/ask` hot path; violates honest-latency and couples the answer to Stripe uptime.
  - **Report at the `/v1/ask` request boundary** — would bill cached plans; the meter stays at the LLM call site per `SK-PREMIUM-007`.
