-- SK-GTM-009 — the paying-customer watchlist's conversion timestamp.
--
-- `converted_at` records the moment a customer FIRST reached a paying
-- status (`active`/`trialing`). It gets its own column because
-- `updated_at` is rewritten by every subsequent subscription sync
-- (renewals, cancel-at-period-end toggles) — the conversion moment
-- would be lost. Stamped exactly once in `syncSubscriptionFields`
-- (apps/api/src/stripe/webhook.ts) via COALESCE; never overwritten.
--
-- Nullable by design: rows that never reach a paying status (e.g.
-- `incomplete` checkouts that expire) stay NULL, and any pre-migration
-- row starts NULL (no backfill — `updated_at` would be a lie).

ALTER TABLE customers ADD COLUMN converted_at INTEGER;
