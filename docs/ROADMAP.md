# Roadmap

The task queue for `GLOBAL-043`
([attach-first](decisions/GLOBAL-043-attach-first-autonomous-dba.md)). Order is
priority; one box is one merged PR; a done box is deleted (git holds it). The
scheduled run takes the first open, unblocked, unclaimed box
([`/daily`](../.claude/commands/daily.md) step 2). Each box moves a step of
[`END_GOAL.md`](END_GOAL.md) and names its number: KPIs A–C and the love gate
are defined in `GLOBAL-043` item 9.

## 0 — Fix first

- [ ] LogSnag is the pager only, and pages once per outage. On 2026-11-21 the free quota hit 2,023 / 2,500 logs (≥ 80 %, emailed to the founder); at the cap, real pages (payment failed, sign-in outage) drop silently. Founder OK'd (2026-11-21), amending in the same PR `GLOBAL-024` ("all events stay in the same LogSnag sink"), `SK-EVENTS-006` / `-010` / `-011` / `-012` / `-013` / `-014`, `SK-TRUST-004` and `SK-QUAL-002` (`#north-star`) and the runbook's "sole sink" rows:
  - send LogSnag only `notify: true` events; every `notify: false` event (demand-signal, pricing, `db.created`, the `#north-star` KPIs) stays in PostHog, which already receives them and, as their only sink, takes over their ack/retry from LogSnag
  - push only the day's first `user.auth_failed` and keep the rest as silent LogSnag rows — the one `notify: false` exception, since that event never goes to PostHog and its rows are the apology list. One review walk's 30 magic-link 500s on the `pr-1297` preview pushed 20 alerts (`AUTH_FAILED_DAILY_CAP`, `SK-EVENTS-006`)
  - preview versions emit no events: they share prod's `EVENTS_QUEUE`
  - Number: LogSnag logs / month, ~2,000 → the pages plus `user.auth_failed` rows; alert pushes per outage, 20 → 1

## 1b — Real-traffic proof

Postgres spike (market proof, `SPIKE_PG_URL`, `GLOBAL-043` item 10) and the
D1 attach on the real rateme12 (dogfood, `RATEME12_D1_TOKEN`,
[`002`](history/dogfood-iterations/002-rateme12-attach.md)). Number: KPI A on
attach; KPI B = one applied index with its before/after p95 (D1: and rows
read).

- [ ] rateme12: apply one D1 proposal, record p95 and rows read before/after — KPI B on a real D1 ⛔ see blocked-by-human.md (re-gate recruiting). Run 294: Tier 1 plans joins / subqueries too and judges 62.4 % of the 24 h rows read by plan (was 0.1 %) — 0 proposals: 45.7 % already index-served, 16.6 % one whole-table count; the rest is one-table aggregates (17.3 %) and one clipped text (16.9 %). No missing index until the workload changes (the CI job's funnel shows when it does); a Tier 0 apply verifies `unmeasured` (no query text)

## 2 — Deletion PR series

Only after the spike passes. One subsystem per PR, deletion-only, CI green.
Number: LOC removed, KPIs A–C unchanged.

- [ ] The hosted / infer path: `insert()` + widen (`apps/api/src/insert/**`), `db-create/**` provisioning and compile-write-ddl, tenant roles
- [ ] The NL-specific `/v1/ask` machinery ⛔ see blocked-by-human.md (which pieces)
- [ ] `tools/eval` (BIRD / Spider)
- [ ] Anonymous mode
- [ ] Agent-memory and expert-knowledge rails
- [ ] ICP-mining, GTM metrics, PMF survey
- [ ] Other-language SDKs and framework wrappers

## 3 — Playbook proposal kinds

Postgres and D1 each. Number: KPI B per kind, KPI C held at 100 %.

- [ ] Unused-index drops
- [ ] Bloat / autovacuum
- [ ] Retype / enum proposals
- [ ] Partitioning at size thresholds
- [ ] Retention crons
- [ ] Sharding / engine placement

## Sequencing rationale

1a needs no secret, so it runs first and builds every instrument 1b
measures with. A 1b track starts once its secret is set and 1a's boxes for
its engine are merged, then outranks 1a; the two 1b tracks may alternate. The
spike is the market proof: its pass is the only thing that unlocks deletion,
because deleting before a measured delta would discard the fallback with no
evidence the bet works. Deletion goes in `GLOBAL-043`'s list order (largest
surface first), and the playbook follows `GLOBAL-043` item 8's order, so each
kind reuses the loop the previous one proved.

## SEO — the organic-search lane

Founder steer 2026-11-07 (`GLOBAL-043` amendment): runs whenever no box
above is open and unblocked. Goal by 2027-05-07: **1,000 Google clicks /
28 d** (GSC `sc-domain:nlqdb.com`; 22 on 11-07) and **DR4 ≥ 20** for
`nlqdb.com` (0). Number per box: its direct input, then GSC clicks /
impressions / position re-read ≥ 14 d later (`bun scripts/gsc-pull.ts`,
`bun scripts/ahrefs-dr.ts`).

- [ ] Brand: from 2026-11-25, re-read `nlq` / `nlqdb` positions (`nlq` pos 72.9 before run 287 shipped `sameAs` 1 → 4 + `alternateName` `nlq`; titles already carry the brand) — top 3 deletes the box, else the next brand input
- [ ] Submit `docs.nlqdb.com/sitemap-index.xml` in GSC (only `nlqdb.com/sitemap.xml` is submitted) ⛔ see blocked-by-human.md — the service account is a Restricted user, which can't submit sitemaps (run 295)
- [ ] Page-1 CTR: from 2026-11-30, re-read the 5 page-1 `/solve` pages run 295 made answer-first (lede opens with the SQL, not the pitch; `FAQPage` + hand-written meta were already on all 7 `/solve` + `/vs` targets) — baseline **3 clicks / 187 impr = 1.6 %** (28 d to 11-14); a gain extends answer-first ledes to every `/solve` page, else the box is deleted
- [ ] Referring domains: every free listing and README backlink an agent can file (MCP registries, awesome-lists, GitHub topics) — number: referring domains, DR4. Run 299 audit: of the live listings, GitHub, RubyGems and Glama link `nlqdb.com` `nofollow` (no DR); docs.rs is the one followed link; Smithery's page 404s though its registry entry is live. The rest are account-walled, other-repo PRs or 🔒 public-copy-gated (`blocked-by-human.md`). Run 301: pkg.go.dev (the `cli` module, unlisted) renders README links `nofollow` too — no agent-fileable followed listing is left ⛔ see blocked-by-human.md (mcp.directory, Anthropic connector)
- [ ] `/` and docs copy to attach-first ⛔ see blocked-by-human.md (🔒 public-copy switch)
