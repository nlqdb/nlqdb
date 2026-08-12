# SK-GTM-007 — First-touch attribution: one localStorage slot, persisted on the created DB row

- **Decision:** Acquisition attribution is **first-party and first-touch**.
  The web layout (`Base.astro`) calls `captureFirstTouch()`
  (`apps/web/src/lib/attribution.ts`) on every page load: the FIRST
  touch a device makes (UTM params, external referrer host, landing
  pathname) is stored once in `localStorage["nlqdb_src"]` and never
  overwritten. The web DB-minting surfaces forward it as the request
  `source` field — `postAskCreate` (`/v1/ask`), the signed-in chat
  create path (`ChatPanel`'s unpinned `client.ask`, which reads
  `firstTouchSource()`; the marketing-origin touch reaches the app
  origin via the [`SK-ANON-015`](../../anonymous-mode/decisions/SK-ANON-015-cross-origin-handoff-url-fragment.md)
  handoff `src` field — without it a signed-in create would attribute to
  the post-OAuth referrer), and `postConnect`
  (`/v1/db/connect`, else a BYO connect-first signup reads `untracked`);
  the API sanitizes it (`sanitizeAskSource` — whitelist keys, 160-char
  caps, **drop-never-400**) and persists it to `databases.source_json`
  (migration `0024`) off the response path (`waitUntil`, best-effort).
  Adoption re-tenants that row untouched, so
  a stranger signup stays attributed to the channel that produced it.
  The channel key per metric row is `utm_source`, else referrer host,
  else `direct`; rows with no capture (pre-instrument, CLI/SDK/MCP) are
  `untracked` so instrument coverage is itself a visible number.
  **`utm_source` values are canonical in
  [`docs/research/acquisition-channels.md`](../../research/acquisition-channels.md)** —
  every externally published nlqdb URL carries its ledger key.
- **Core value:** Free, Bullet-proof, Simple
- **Why:** The first stranger cohort can never be attributed
  retroactively — waiting for "stranger signups > 0" leaves the 2026-07-19
  acquisition focus's (`GLOBAL-038`) channel experiments unmeasurable
  exactly when their readout matters. First-party capture is the D1 ground
  truth PostHog can't be (client-blockable, different population);
  first-touch matches "which channel *brought* them", and one slot needs
  no consent-scoped cookie.
- **Consequence in code:** Attribution is telemetry, never load-bearing:
  every layer (capture, parse, persist) drops on failure — a malformed
  `source` never 400s a create, a failed D1 write only logs
  (`gtm_source_write_failed`). New channels add a ledger row, not code.
  `acquisition.*` metrics group by the SQL channel expression
  (`SOURCE_CHANNEL_SQL`) — reviewers reject a second channel-derivation.
  First write wins on both layers (localStorage guard + `source_json IS
  NULL`).
- **Alternatives rejected:**
  - Wait for strangers before instrumenting (the prior parking) —
    attribution can't be backfilled; rejected by the acquisition focus.
  - PostHog-only attribution — client-blockable and a different
    population than the D1 rows the funnel counts (GLOBAL-034 keeps it
    for behavioral funnels).
  - Server-side capture from the `Referer` header — the create POST's
    referrer is our own page, never the acquiring channel.
  - A dedicated touches table keyed by principal — a second store + join
    for data 1:1 with the created row; the column is the smaller diff.
