# SK-GTM-003 — Daily `gtm_snapshots` rows make progress observable; written by cron + on-read

- **Decision:** Migration `0022_gtm_snapshots.sql` adds `gtm_snapshots
  (day TEXT PRIMARY KEY, metrics_json TEXT, created_at)`. A headline
  subset of `computeGtmMetrics` is written as an `INSERT OR IGNORE`
  per-UTC-day row from two triggers: the daily `scheduled()` cron
  (`0 4 * * *`, best-effort, before the Tinybird early-return) and —
  belt-and-braces — a `waitUntil` write on every authorized
  `GET /v1/admin/metrics`. The endpoint returns up to 90 snapshot rows for
  the dashboard.
- **Core value:** Free, Bullet-proof, Honest latency
- **Why:** D1 holds only current state; without an append-only daily row,
  "are we making progress?" is unanswerable next month. INSERT OR IGNORE
  on the UTC day makes both writers race-safe and idempotent; the on-read
  write accrues history across cron outages (one no-op write per view). A
  JSON payload keeps the shape additive (`SK-EVENTS-002`) without a
  migration per metric.
- **Consequence in code:** Snapshot JSON fields are additive-only; a
  renamed/retyped field needs a new key, old keys stay readable. The cron
  write must never throw past its try/catch (a miss can't break the sweep
  or analyser). Rows are never updated or deleted — first write of a day
  wins.
- **Alternatives rejected:**
  - Reconstruct trends from PostHog later — different population (events,
    client-blockable) than D1 truth; never reconciles with the scorecard.
  - One column per metric — a migration per metric; JSON + additive keys
    is the `ProductEvent` lesson.
  - Cron-only writes — a single missed cron leaves a hole; the on-read
    write is free insurance.
