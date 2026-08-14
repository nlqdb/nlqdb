-- Hosted-premium meter (SK-PREMIUM-009 / SK-PREMIUM-011 / SK-PREMIUM-017).
-- Schema lands now; the meter stays dark until an operator flips
-- PREMIUM_METER_LIVE + provisions PREMIUM_ANTHROPIC_API_KEY (blocked-by-human).
--
-- 1. premium_allowance_period — one row per (customer, billing-period). The
--    period is keyed by `period_start`, which holds the current billing-period
--    boundary (customers.current_period_end). When Stripe advances that
--    boundary on renewal, the next premium dispatch inserts a fresh
--    consumed=0 row — that IS the no-carryover monthly reset (SK-PREMIUM-009),
--    no sweep job needed. `overage_spent_cents` is the running overage ledger
--    the per-key spend cap (SK-PREMIUM-006) and reconciliation read.
--
-- 2. premium_meter_events — idempotent overage-event log (SK-PREMIUM-002/017).
--    `event_id` = premium:<customer>:<request-key> dedups a retried /v1/ask so
--    it can't double-bill; `stripe_status` (pending|reported|error) is the
--    queryable signal the daily reconciliation compares against Stripe.
--
-- 3. user.overflow_policy — per-account exhaustion behavior (SK-PREMIUM-011):
--    'meter' (default, soft-meter overage) or 'fallback' (route to the free
--    chain for the rest of the period, surfaced in trace, never silent).
--
-- ON DELETE CASCADE on the user FK matches migration 0002/0004 (GDPR: deleting
-- a user removes their billing rows).

CREATE TABLE premium_allowance_period (
  customer_id                 TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  period_start                INTEGER NOT NULL,
  plan_tier                   TEXT    NOT NULL CHECK (plan_tier IN ('hobby','pro')),
  allowance_total_requests    INTEGER NOT NULL,
  allowance_consumed_requests INTEGER NOT NULL DEFAULT 0,
  overage_spent_cents         REAL    NOT NULL DEFAULT 0,
  updated_at                  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (customer_id, period_start)
);

CREATE TABLE premium_meter_events (
  event_id      TEXT    PRIMARY KEY,
  customer_id   TEXT    NOT NULL,
  period_start  INTEGER NOT NULL,
  model         TEXT    NOT NULL,
  cost_cents    REAL    NOT NULL,
  reported_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  stripe_status TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (stripe_status IN ('pending','reported','error'))
);
CREATE INDEX idx_premium_meter_events_period ON premium_meter_events (customer_id, period_start);
CREATE INDEX idx_premium_meter_events_status ON premium_meter_events (stripe_status, reported_at);

-- Default 'meter' (SK-PREMIUM-011). CHECK keeps the column to the two policies.
ALTER TABLE user ADD COLUMN overflow_policy TEXT NOT NULL DEFAULT 'meter'
  CHECK (overflow_policy IN ('meter','fallback'));
