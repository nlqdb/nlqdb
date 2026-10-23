# Dogfood iteration 002 — nlqdb attached to rateme12's D1

**Status:** open 2026-10-22 · **Governs:** [`GLOBAL-042`](../../decisions/GLOBAL-042-dogfood-iteration-loop.md) loop (iterate → retro → cleanup) · **Measures:** [`GLOBAL-043`](../../decisions/GLOBAL-043-attach-first-autonomous-dba.md) KPIs A–C · **Replaces:** [001](./001-rateme12.md) (migrate plan, retired)

## 1. Goal

The real rateme12 (`rateme12.com` + `api.rateme12.com`, Cloudflare D1, see
[001 §4](./001-rateme12.md#4-product-inventory--filled-at-5a-step-2)) is
starting to scale. nlqdb **attaches** to its D1 — it does not move it:

1. **Attach** with a Cloudflare API token + account id + database id
   (`RATEME12_D1_TOKEN`, [`blocked-by-human.md`](../../blocked-by-human.md)).
2. **First proposals within minutes** (KPI A < 5 min).
3. **One index applied** with before/after on rateme12's hottest query
   (KPI B ≥ 1), on two deltas: p95 query time **and** rows read.
4. **Every change in the `dba_changes` ledger** with its DDL, its inverse,
   both measurements and who decided. A regression auto-reverts (KPI C).

rateme12's app code is not changed; nlqdb is never on its request path.
The clone (`apps/rateme12`, `rateme12.nlqdb.com`) gets no further work and
goes in the deletion series.

## 2. What the D1 observer reads

Verified 2026-10-22 from Cloudflare docs; everything else is **unverified
until the first attach** (introspect the GraphQL schema then, record it in
§5).

| Tier | D1 source | Verified |
|---|---|---|
| 1 workload | GraphQL `POST https://api.cloudflare.com/client/v4/graphql`, dataset `d1QueriesAdaptiveGroups` (also `d1AnalyticsAdaptiveGroups`, `d1StorageAdaptiveGroups`), `accountTag` filter: query text (bound params stripped), rows read / written, query time, `queryEfficiency` = rows returned / rows read — near 0 on a frequent query ⇒ missing index. Sampled ("adaptive"), 31-day retention ([metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)) | dataset + meaning yes; field names beyond `query` / `databaseId` and the token scope **no** |
| 0 catalog | REST `POST /accounts/{id}/d1/database/{id}/query` (D1 Read): `PRAGMA table_list`, `table_info`, `index_list`, `index_info`, `index_xinfo`, `foreign_key_list` ([SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)) | yes |
| 2 what-if | `EXPLAIN QUERY PLAN` — `SEARCH … USING INDEX` vs `SCAN` ([use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)). **No hypothetical index:** a real what-if is a real `CREATE INDEX`, billed as rows written — so the verify window judges, not a dry run | yes |
| 3 truth | Tier 1 re-read for the same query text after apply | — |

**Apply:** `CREATE INDEX IF NOT EXISTS` + `PRAGMA optimize` over the same
REST endpoint (D1 Edit). D1 caps a statement at 30 s and runs
single-threaded ([limits](https://developers.cloudflare.com/d1/platform/limits/)),
so a proposal is gated by table size: an index that cannot build in 30 s
says so and offers its DDL for a maintenance window. **Undo:** `DROP INDEX`
from the stored DDL; a drop's inverse is the original `CREATE`, so the
ledger holds DDL text. Time Travel
([docs](https://developers.cloudflare.com/d1/reference/time-travel/)) is a
destructive whole-DB restore (30 d paid / 7 d free) — a coarse safety net,
never the per-change undo.

**Money:** rows read bill at $0.001 / M past 25 B / month, rows written at
$1 / M past 50 M ([pricing](https://developers.cloudflare.com/d1/platform/pricing/)).
An index cuts rows read; each write to an indexed column adds a row
written. So on D1, KPI B reports both deltas — p95 and rows-read cost —
and the proposal's cost line names the write overhead.

**Competition:** Cloudflare has an unmerged docs PR for
`wrangler d1 insights --recommendations`
([#32323](https://github.com/cloudflare/cloudflare-docs/pull/32323)).
D1 is the dogfood engine; Postgres is the market.

## 3. Build plan — built on a throwaway D1 first (`GLOBAL-043` roadmap 1a), then run here

1. **Observer:** Tier 0 + Tier 1 snapshot of rateme12's D1 behind the
   `packages/db` adapter seam (the same seam the Postgres observer uses —
   no per-engine loop). Number: KPI A (attach → first proposal).
2. **Proposal:** the hottest low-`queryEfficiency` query → one
   `create_index` proposal with diff, inverse, expected effect from
   `EXPLAIN QUERY PLAN`, cost (rows written to build, write overhead).
3. **Apply + verify:** applied by the founder's one click, within the 30 s
   cap; the verify window re-reads Tier 1. Number: KPI B on p95 and rows
   read; a regression auto-reverts (KPI C).
4. **Ledger:** the change, its inverse, both measurements and the deciding
   principal visible at `/app/dba`.

## 4. Fixed rules

- Public surfaces only, per `GLOBAL-042`; no hand-run DDL on rateme12's D1 —
  every change goes through a proposal and the ledger.
- The token never leaves CI; nothing in this repo holds its value.
- Auto-apply stays off; the owner — or an agent within the owner's
  ceiling — clicks apply.

## 5. Numbers — filled as the iteration runs

| Number | Value |
|---|---|
| KPI A — attach → first proposal | unmeasured |
| KPI B — applied with measured p95 gain (and rows-read Δ) | 0 |
| KPI C — regressions auto-reverted / applied | — |
| Verified GraphQL fields + token scopes | pending first attach |

## 6. Retro and cleanup

Retro fields and cleanup per [`TEMPLATE.md` §7–§8](./TEMPLATE.md), minus the
schema quarantine (nothing is inferred). Cleanup never drops a kept index:
the applied changes are the outcome.
