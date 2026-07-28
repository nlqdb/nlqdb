# SK-GTM-005 — Synthetic traffic is stamped at DB create; unique-people counts exclude it

- **Decision:** Migration `0023_synthetic_traffic_flag.sql` adds
  `databases.synthetic INTEGER NOT NULL DEFAULT 0`, stamped at every
  create path (hosted create both arms + BYO connect) when
  `isSyntheticRequest()` (`apps/api/src/synthetic-ua.ts`) says the request
  self-identifies as nlqdb-generated: the stranger-test walker UA token
  (`SK-ONBOARD-007`) or a preview/mock deploy (`NODE_ENV=preview` /
  `MOCK_IDP=1`, `SK-AUTH-018` — previews share the prod D1). Then
  `computeGtmMetrics` reports the **unique-people block**:
  `uniques.realUsers` (distinct stranger accounts — `user.email` is
  UNIQUE, so accounts ARE unique people), `uniques.anonDevices` split
  synthetic/organic (one anon tenant id = one device, `SK-ANON-008`; a
  device is synthetic when ANY of its DBs carries the flag), plus
  `funnel.anonDbsSynthetic`, `funnel.adoptionsReal` (adopter email outside
  the internal set) and `funnel.adoptionRateReal`. Existing fields keep
  their semantics (`SK-GTM-001` — additive only). Write-side complement of
  `SK-ONBOARD-007`: that keeps walker *asks* out of the first-10 counters;
  this keeps walker/preview *DBs and devices* out of the funnel counts.
- **Core value:** Bullet-proof, Simple, Free
- **Why:** The founder's headline question is "how many real unique
  people", and the anon side was unanswerable: the daily walker
  (`SK-STRG-003`) and preview deploys create anon DBs in prod D1 that
  read as strangers. Detection is strictly self-identification — walker
  UA + preview env flag — never a host/IP/UA heuristic: a false positive
  silently erases a REAL stranger from the north-star, worse than
  counting an extra robot.
- **Consequence in code:** `DbCreateArgs.synthetic` / `ConnectByoArgs.
  synthetic` are resolved only at the route via `isSyntheticRequest`
  (orchestrators pass them through); reviewers reject a second detection
  site or any IP/host rule. Dropping the `nlqdb-stranger-test` UA token
  (or unsetting `MOCK_IDP`/`NODE_ENV=preview`) silently re-pollutes the
  counts — treat as a breaking change. Rows created before migration 0023
  default to organic; the 90-day anon sweep ages that backlog out.
- **Alternatives rejected:**
  - Host/IP heuristics for previews — previews are same-origin merged
    workers; a host list rots and misfires on real users.
  - Excluding by the walker's 25 seeded prompt strings — goals aren't
    stored on `databases`; fragile string coupling.
  - Backfilling the pre-0023 backlog — no reliable key exists; the sweep
    resolves it within 90 days for free.
