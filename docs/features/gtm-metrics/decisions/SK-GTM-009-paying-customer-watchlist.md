# SK-GTM-009 — Paying-customer watchlist: per-customer drill-down, built ahead of the first conversion

- **Decision:** `GtmMetrics` gains a top-level `customers` array — one row
  per `customers` table entry (email + internal flag, subscription status,
  `convertedAt`, renewal fields, owned-DB count, first-10 ask/ok counters,
  last activity) — rendered as a "Paying customers" watchlist section on
  `/app/admin`. Migration `0027_customers_converted_at.sql` adds
  `customers.converted_at`, stamped **once** by the webhook's subscription
  sync the first time a status reaches `active`/`trialing` and never
  overwritten. Built before the first paid user exists (founder directive
  2026-08-08), so the conversion moment lands on an already-instrumented
  surface; this removed the "first paying user" half of the observability
  dashboards-as-code trigger.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** The first paying customer is the highest-signal user the product
  will have had, and learning from their behavior needs per-account
  drill-down that aggregate funnel numbers can't provide — building it
  *after* they arrive means their first days go unobserved. LogSnag's
  `billing.subscription_created` push (SK-STRIPE-005) announces the moment;
  the watchlist is the durable "all eyes" surface the founder returns to.
  Per-user rows are safe here because the population is naturally bounded
  (paying customers, `LIMIT 50`) and it's a D1 admin read — exactly the
  split `SK-OBS-006` mandates (user behavior never rides OTel metrics,
  where `SK-OBS-002`'s cardinality budget forbids `user_id` labels).
  `converted_at` needs its own column because `updated_at` is rewritten by
  every renewal/cancel sync — the conversion moment would be lost.
- **Consequence in code:** Watchlist rows come only from
  `computeGtmMetrics` (`SK-GTM-001` — no re-derived SQL elsewhere). The
  stamp lives in `syncSubscriptionFields` (`apps/api/src/stripe/webhook.ts`)
  as `COALESCE(converted_at, unixepoch())` gated on `active`/`trialing` —
  reviewers reject any second write site or any path that overwrites a
  non-null value. Rows carry the `INTERNAL_EMAIL_SQL` split so a founder
  test-purchase can't masquerade as the first real customer. First-10
  counters are labeled the lower bound they are (saturate at 10/DB,
  `SK-ONBOARD-006`). Reviewers reject per-user OTel metrics offered as a
  substitute for this surface.
- **Alternatives rejected:**
  - Grafana dashboards-as-code for this — per-user drill-down would blow
    the `SK-OBS-002` cardinality gate; system dashboards stay parked on the
    SLO-breach trigger.
  - Reuse `updated_at` as the conversion time — overwritten by every
    subsequent subscription sync; the moment is unrecoverable.
  - PostHog per-user timeline — `GLOBAL-034` keeps D1 as truth for the
    founder dashboard; behavioral funnels can complement later, not
    replace the D1 read.
