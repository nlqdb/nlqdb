# SK-E2E-007 — Staging spin-up purges the fixture account's registry rows

Part of [`e2e-coverage/FEATURE.md`](../FEATURE.md); sharded per
`docs/feature-conventions.md` §1 (FEATURE.md is at the D4 cap).

- **Decision:** `_e2e-staging.yml` recreates the Neon `e2e` branch, then
  immediately deletes every `databases` and `chat_message` row owned by the
  mock-IdP fixture account (`test@example.com`) from the shared D1 control
  plane, before the preview version is uploaded.
- **Core value:** Bullet-proof
- **Why:** Previews share prod's control plane — `wrangler versions upload`
  reuses `wrangler.toml`'s D1 binding — while the data plane (the Neon `e2e`
  branch holding the fixture schemas) is destroyed at both ends of every run.
  So any fixture registry row that survives a run points at a schema that no
  longer exists, and the stale rows are not benign: Suites B/C pin the
  `users` DB by sidebar name, so a stale same-name row can win the pin and
  fail every query as "Couldn't reach the database"; and Suite C's
  `#delete-remaining-db` walks the backlog one typed-confirm modal at a time,
  timing out once enough accumulate (~27 by 2026-07-11, run
  [29154050866](https://github.com/nlqdb/nlqdb/actions/runs/29154050866)) —
  while its name-scoped walk never removes non-`users*` leftovers at all
  (a `db_products_tracker_*` row survived multiple runs). In-suite UI cleanup
  cannot be the invariant: a failed or cancelled run leaves rows behind by
  definition.
- **Consequence in code:** The purge step lives in `_e2e-staging.yml`
  directly after the branch recreation, so both callers (`e2e-opencheck.yml`,
  `e2e-examples.yml -f live=true`) get it and a crashed prior run changes
  nothing. It is scoped strictly to the fixture email: anon-tenant rows are
  left to the 90-day anon sweep (`SK-ANON-002`) because e2e anon strays are
  indistinguishable from real prod anon rows in D1. Suite C's cleanup tests
  now verify only the current run's DBs.
- **Alternatives rejected:**
  - Harder in-suite cleanup (longer timeouts, more retries) — cost grows with
    the backlog, and a crashed run still leaks.
  - Purging at run end (the `cleanup` job) — a cancelled or crashed run skips
    it; spin-up is the only point every run is guaranteed to pass through.
  - A preview-scoped D1 database — a real isolation fix but a much heavier
    change (separate bindings, migrations, drift); the shared registry is
    harmless once fixture rows are purged.
