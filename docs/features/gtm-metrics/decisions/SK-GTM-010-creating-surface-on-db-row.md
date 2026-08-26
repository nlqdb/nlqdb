# SK-GTM-010 — Record the creating surface on the DB row (web / cli / mcp / embed)

- **Decision:** Every `databases` row records the **surface that created
  it** in a new column `source_surface` (migration `0033`). The value is
  the canonical `NlqSurface` (`hero` | `chat` | `embed` | `cli` | `mcp`)
  derived **server-side** from the authenticated principal via
  `surfaceFromPrincipal` ([`SK-EVENTS-010`](../../events-pipeline/FEATURE.md)) —
  the same one place OTel spans and product events already read — at
  create (`POST /v1/ask` create branch) and at BYO connect
  (`POST /v1/db/connect`). It is stamped off the response path in the same
  best-effort helper that persists `source_json`
  (`persistDbSource`, `COALESCE(...)` so the first write wins and a replay
  is a no-op). `NULL` = created before this instrument.
  This is **orthogonal to [`SK-GTM-007`](SK-GTM-007-first-touch-attribution.md)'s
  `source_json`**: surface answers *which client minted the DB*, `source_json`
  answers *which marketing channel brought the visitor* (web-only, since a
  headless client has no referrer or UTM). Both live on the one row; neither
  derives the other. The admin read exposes `acquisition.dbsBySurface`
  (every DB grouped by surface, `untracked` = pre-instrument).
- **Core value:** Free, Bullet-proof, Simple
- **Why:** The GTM funnel could see *that* a DB skipped the web first-touch
  instrument (it fell into the `source_json` = `untracked` bucket) but not
  *why* — a CLI create, an MCP-host create, and a pre-instrument web create
  were indistinguishable, so "how much adoption runs through cli/mcp vs the
  web" — the exact question the [`GLOBAL-026`](../../decisions/GLOBAL-026-llm-strategy-byollm-hosted-premium.md)
  developer-surface bet needs answered — had no D1 read. The principal kind
  is already resolved on every authenticated request and already mapped to a
  canonical surface for events; stamping that same value onto the created
  row is the smallest honest closure of the gap, with no new client contract
  (nothing to spoof: the surface is derived from the credential, not sent in
  the body).
- **Consequence in code:** `source_surface` is telemetry, never
  load-bearing — the same drop-on-failure discipline as `source_json`: a
  failed write only logs (`gtm_source_write_failed`), never 400s or blocks a
  create. `persistDbSource` is the single writer for both source columns so
  the guard and log key can't diverge; every create/connect calls it
  unconditionally (surface is always known, unlike the optional
  `source_json`). Metric rows group by `COALESCE(source_surface, 'untracked')`
  — reviewers reject a second surface-derivation, exactly as for
  `SOURCE_CHANNEL_SQL`. **Known limit (inherited, not introduced):**
  `surfaceFromPrincipal` maps every `sk_live_` caller to `cli`, so the
  server-side **SDK** (which authenticates with an `sk_live_` key) is
  counted as `cli` — SDK and CLI are not separately distinguishable at the
  principal layer. Splitting them needs a distinct `api`/`sdk` surface in
  `@nlqdb/events` keyed off the `User-Agent`
  ([`SK-CLI-014`](../../cli/decisions/SK-CLI-014-no-client-telemetry.md)'s
  `nlq/…` vs `@nlqdb/sdk/…` product token), deferred until that volume is a
  signal worth the split (the `surfaceFromPrincipal` comment already flags
  this).
- **Alternatives rejected:**
  - Parse the surface out of the `User-Agent` at create time — a second,
    fuzzier derivation of a fact the principal kind already carries exactly;
    only earns its place once we actually need the CLI-vs-SDK split above.
  - Overload `source_json` with a `surface` key — conflates two orthogonal
    dimensions in one JSON blob and forces `SOURCE_CHANNEL_SQL` to guard
    against a non-channel key; a typed column is the smaller, queryable diff.
  - A separate `db_surfaces` table keyed by `dbId` — a second store + join
    for a value 1:1 with the created row; the column is strictly smaller
    (same reasoning `SK-GTM-007` used to reject a touches table).
