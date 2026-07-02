-- Waitlist removed end-to-end (founder directive 2026-07-01: the
-- product is open, no waitlist). Drops the table from 0007 including
-- the 0015 persona column and idx_waitlist_created (indexes drop with
-- the table). Prod data at drop time: 81 rows (80 synthetic + 1
-- founder) — founder-confirmed nothing worth keeping.

DROP TABLE waitlist;
