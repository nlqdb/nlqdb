-- W5 — daily workload-analyser audit trail.
--
-- One row per reshape proposal that the cron actually attempted (per
-- `SK-MIGRATE-005`). The UNIQUE INDEX on `(db_id, query_hash, run_date)`
-- enforces same-day idempotency — a re-run of the cron within one UTC
-- day is a no-op (`SK-MIGRATE-006`).
--
-- `kind` ∈ {`clickhouse_pipe_create`, `pg_add_column_suggestion`} per
-- `SK-MIGRATE-003`. `before_json` carries the fingerprint snapshot
-- (schema_hash, query_hash, stats); `after_json` carries the Pipe name
-- on successful clickhouse_pipe_create (null for advisory or for
-- failures). `reasoning` is a one-line human-readable trigger or error.
--
-- `/v1/ask` reads this table to surface the `pipe_advisory` field on
-- the response when an audit row exists for the resolved (db_id,
-- query_hash) within the last 24h.

CREATE TABLE workload_analyser_runs (
  id TEXT PRIMARY KEY,
  db_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  schema_hash TEXT NOT NULL,
  run_date TEXT NOT NULL,            -- 'YYYY-MM-DD' UTC
  run_at INTEGER NOT NULL,            -- Unix seconds
  kind TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  reasoning TEXT NOT NULL
);

-- Same-day idempotency: re-runs of the cron on a given UTC date for
-- the same (db_id, query_hash) DO NOTHING. Recovery from a transient
-- failure happens on the next day's cron.
CREATE UNIQUE INDEX idx_workload_runs_unique
  ON workload_analyser_runs (db_id, query_hash, run_date);

-- Lookup index for the /v1/ask `pipe_advisory` surface (24h window
-- per resolved (db_id, query_hash)).
CREATE INDEX idx_workload_runs_db_run
  ON workload_analyser_runs (db_id, run_at DESC);
