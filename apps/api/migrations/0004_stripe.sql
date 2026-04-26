-- Slice 7 — Stripe webhook persistence.
--
-- Two tables drive the `/v1/stripe/webhook` handler:
--
-- 1. `customers` — 1:1 with `user`. PK is user_id (one customer per
--    user, locked-in design). `stripe_customer_id` is UNIQUE because
--    every row corresponds to exactly one Stripe customer; a duplicate
--    is a webhook-handler bug.
--
-- 2. `stripe_events` — idempotency log. PK is Stripe's evt_xxx ID. The
--    handler does `INSERT ... ON CONFLICT DO NOTHING RETURNING 1`
--    before any side effect, so a Stripe webhook retry hits the unique
--    constraint and we return 200 without reprocessing.
--    `payload_r2_key` points at the raw-body archive in R2
--    (`stripe-events/YYYY/MM/DD/{event_id}.json`); the put runs in
--    `ctx.waitUntil`, so a missed archive doesn't block the response.
--
-- No `trial_end` / `trialing` column intentionally — PLAN §5.3 rules
-- out a Stripe-side trial period. The `status` CHECK still accepts
-- `trialing` defensively (a manually-created Stripe sub in Dashboard
-- could land in that state) so an unexpected payload doesn't reject
-- the INSERT, but no nlqdb code path produces it.
--
-- ON DELETE CASCADE on the user FK matches the convention from
-- migration 0002 (session, account) — deleting a user removes their
-- billing rows for GDPR alignment.

CREATE TABLE customers (
  user_id                TEXT    PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT    NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  status                 TEXT    NOT NULL CHECK (status IN (
                                   'incomplete','incomplete_expired','trialing',
                                   'active','past_due','canceled','unpaid','paused')),
  current_period_end     INTEGER,
  cancel_at_period_end   INTEGER NOT NULL DEFAULT 0,
  price_id               TEXT,
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_customers_stripe_customer ON customers (stripe_customer_id);
CREATE INDEX idx_customers_status ON customers (status);

CREATE TABLE stripe_events (
  event_id       TEXT    PRIMARY KEY,
  type           TEXT    NOT NULL,
  payload_r2_key TEXT,
  received_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  processed_at   INTEGER
);
CREATE INDEX idx_stripe_events_received ON stripe_events (received_at);
