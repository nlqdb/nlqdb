-- Migration number: 0028 	 2026-08-10T00:00:00.000Z
--
-- Cross-tenant granted-query usage ledger (SK-EKP-008, EK-06 box 3).
--
-- One row per successfully-executed granted `/v1/ask` query. This is the
-- public-half meter: the unit SK-PIVOT-023 axis-2 fee bills against later,
-- in the private `experts` surface (SK-EKP-003). No fee logic, no fee %,
-- and no Stripe call lives here (SK-EKP-002) — nlqdb's public core emits
-- the usage record; only the private surface turns it into money.
--
-- Billing invariant (SK-EKP-008, hardened 2026-08-07 after the Fable
-- review of #919): a granted query *requires* an idempotency key
-- (broker-synthesized + persisted when the client omits one); a replay
-- under the same key emits NO second usage record. The
-- `UNIQUE (grant_id, idempotency_key)` constraint makes that idempotency
-- structural — the emit is an `INSERT ... ON CONFLICT DO NOTHING`, so a
-- retry can never double-count and there is no read-then-write race (same
-- fail-safe idiom as the `grants` revoke UPDATE). Dedupe is per-grant: the
-- same client key seen under two different grants is two distinct billable
-- events. When billing ships, the Stripe meter event's `identifier` is
-- this same key (Stripe 2026 Billing Meters dedupe on `identifier`).
--
-- Attribution tuple is (grant_id, grantee_tenant_id, owner_db_id) per
-- SK-EKP-008. `owner_tenant_id` is denormalized so the seller's income
-- statement and the buyer's spend read need no join and survive a later
-- grant delete — the ledger is the durable record, not the grant row.

CREATE TABLE grant_usage (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  owner_tenant_id TEXT NOT NULL,
  owner_db_id TEXT NOT NULL,
  grantee_tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (grant_id, idempotency_key)
);

-- Seller income statement ("who queried how much"): usage they earned.
CREATE INDEX idx_grant_usage_owner ON grant_usage (owner_tenant_id, created_at DESC);
-- Buyer spend ("what I spent"): usage they incurred.
CREATE INDEX idx_grant_usage_grantee ON grant_usage (grantee_tenant_id, created_at DESC);
-- Per-grant rollup for a single listing's usage.
CREATE INDEX idx_grant_usage_grant ON grant_usage (grant_id);
