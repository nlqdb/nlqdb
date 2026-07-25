# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22, now 4).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product
progress is secondary this cycle. The agent-movable inputs, in order: reach
R-05 registry listings (0/8 → list or park each), R-04 machine-followable
setup guide (registries' prerequisite), utm-tagging the already-live channels
(dev.to, npm/GitHub READMEs) per `SK-GTM-007`, and R-06 (the track's
falsifier). Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin` (first-touch attribution shipped 07-19 — the first
stranger cohort will be attributable from day one). This supersedes the
morning's agentic-frontier focus: premium-chain work (`SK-LLM-017`, row #20)
is pullable only when no acquisition lever is. **Row #15 is no longer
founder-blocked** — `FALLBACK2_LLM_API_KEY` was set 2026-07-16 (verified 07-22:
the key is present in the [07-17 main run's](https://github.com/nlqdb/nlqdb/actions/runs/29553384150)
pre-flight env and that run passed Suite A 5/5); the row now needs only fresh dispatches.

**Worst number today:** **row #16 Phase-2 exit gate 1/9**; worst engine number is
**row #9 Spider 0.2222** and **row #8 BIRD 0.542** — both dark + fresh (07-19, 5 days), offline
levers exhausted. **Top `blocked-by-human` bullet:** #1 fire the launch sequence (Show HN
draft **idle 41 days since 06-13**, kit ready since 07-19) — the only queue action that can move
real strangers from 0; its age is the company's real cycle time (rule: human-queue). Queue depth
**6** ranked bullets: launch (#1), mcp.so / cursor.directory / awesome-mcp / Claude-dir submissions
(#2–#5, all account-walled), the GLOBAL-039 zone toggle (#6, lowest rank — internal-integrity yield).

**Run 137 is a null run** — no agent-movable lever cleared the step-2 bar in any lane (full finding in
"Last change" below); ships only this step-1 update. **Rule 6 clean** (CI + Security + Release-npm
`success` on `main` `a60bf5b` — verified live this run; latest `deploy-api` `success` on the last code
SHA `c3f0647`; runs 129–136 docs-only, no deploy). **Step 0:** 3 open PRs — #719 (draft Infisical,
oldest at 8 days), #814 (reach `INDEX.md`), #815 (run 138, `scorecard.md`); this run writes only
`scorecard.md` — step-1 exempt, and #815 is its only overlap.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-22 CF GraphQL · users/DBs 07-24 remote-D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **212 pageloads** (07-15→07-22, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 168 + BingBot 2 ⇒ **real-browser ≈ 42** (Chrome 33 + Edge 8 + MobileSafari 1). Flat vs 07-13's ≈49 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — last live remote-D1 read run 134 (07-24), unchanged — no acquisition channel newly live to produce a signal; funnel walkers green via the 07-24 08:34Z acquisition-health cron. The 428 wall is gone (run 56); acquisition now depends on distribution yield |
| 3 | DBs total | **255** (07-24 live remote-D1, flat vs 07-23; synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test. **Attribution instrument verified live in prod 07-24 run 134:** `databases.source_json` column exists (migration 0024), `dbsWithSource` = 0 (accrues from first attributable traffic; DBs 255 flat) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. The stranger create→ask→first-answer path is hardened each run; per-run detail in `git log` |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; fresh recount 07-19 — `/solve` +3 & `/vs` +1 from merged reach solve/vs pages, `/blog` +1 corrects run 92's 36 undercount). Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-24→07-22, re-pulled live 07-24 run 137, byte-flat 6th consecutive read): 6 clicks / 496 impr / avg pos 17.5** — top winnable page `/solve/count-rows-per-day-including-missing-dates/` **66 impr / pos 7.8** (surface's single biggest impression×position opportunity, already on-page-maxed). Prior window: 5 clicks / 454 impr / pos 17.8 (impr 508→454 & pos shift is window-move not decline, clicks flat). 4 click-earning pages: `/security/hall-of-fame/`, homepage, `/architecture/`, `/blog/bird-gold-noise-distinct/`. sitemap 116 submitted / 0 err. Query `"top 10 products by revenue" metabase` pos 6.8 → `/vs/metabase/` (run 125's FAQ lever, merged; delta reads next pull). 7d external referrals = 9 (bing 8, github 1). Internal links **2,970** + **14 cross-app** (0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on **post-revert** main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Recovered +2.8 pp from the 0.514 `SK-LLM-044` reading; flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452) — run-90 `SK-QUAL-006` trigger cleared. Baseline re-seeded 0.5462 → 0.5422 (07-19, `SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); 3 `SK-QUAL-013` windows, `no_sql` 0/135, exec_error 5). Give-back from the reverted 0.2963 `SK-LLM-044` reading (run 90); post-revert engine is byte-identical ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s. Freshness reset 07-19 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window. Deploy health tracked in the Rule-6 line above (all `success` on `main`; run 116 closed the root-`overrides`→no-deploy trigger gap) |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **stale reading — recompute next run:** sdk/mcp/examples ≈1.0 each; opencheck's actual latest `main` run is [29553384150](https://github.com/nlqdb/nlqdb/actions/runs/29553384150) (07-17, `depth=a`) — **PASSED Suite A 5/5** with the 3rd free pool armed (`FALLBACK2_LLM_API_KEY` set 07-16, present in the run env), superseding the failed 07-14 run this row previously cited. **No longer dark, no founder action pending** — freshness now decays only with dispatch cadence | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542, 07-19 post-revert, flat vs baseline — the run-90 regression is cleared); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **8** (re-verified 07-24 run 137, same pinned grep — unchanged since run 130's 12 → 8, which reclassified four bullets **Parked until <trigger>** against their decision records) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). **Standing guards — all three advertised-capability surfaces closed-world CI-swept across web *and* docs**, each deriving truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (`registerTool(...)` sites, `SK-MCP-002`), `cli-verb-integrity.test.ts` (cobra tree), `sdk-method-integrity.test.ts` (shipped `NlqClient` type, `SK-SDK-013`). All 0 phantom live, negative-tested. **Trilogy complete** — no advertised-capability surface remains web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (daily acquisition-health cron run 67 [29815040423](https://github.com/nlqdb/nlqdb/actions/runs/29815040423) against prod, 07-21 08:37Z: verify-flows all-green, stranger-test FLOW-001/002/003 exit 0, FLOW-005 walk 6/6, FLOW-005 stdio 22/22 — 5 tools, no legacy verbs). The run-59 "morph-to-chat gap" is **decided, not a gap** (anon terminus IS the sign-in redirect; SK-WEB-002 chat is post-sign-in) | target 9/9 + both FLOW-005 ✅ **met**. Freshness re-armed 07-21 (GLOBAL-032 7-day rule); per-step JSON artifact proxy-gated from the agent container |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** (07-20 run 103: **dev.to's `live` was really a partial — now genuinely attributable.** The syndication read-through link carried no key, so dev.to→nlqdb.com visits fell back to the `ref: dev.to` referrer (readers/RSS/webviews strip it); tagging the link `…/blog/<slug>/?utm_source=devto` (API `canonical_url` stays clean for SEO) makes them `utm_source`-attributable via `captureFirstTouch`. Now **all 4 live channels** (organic search + dev.to + npm + GitHub) satisfy rule 1's utm-key requirement — the summary's "every published channel's yield is attributable" is finally true. MCP registries: official registry **published 07-22** ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1 active, `websiteUrl` utm-tagged → ledger row #3 in-flight; crawl-fed Smithery/PulseMCP/Glama pending ingest)). First-touch attribution live 07-19: `databases.source_json` + `/app/admin` sources; `dbsWithSource` accrues live (prod migration 0024 applied — verified 07-22). **Run 107 closed the connect-path coverage hole:** `source_json` now persists on `POST /v1/db/connect` too (was `/v1/ask` create-arm only), so a connect-first signup — the natural first action on the just-live github/npm developer channels — is attributable, not `untracked`. **Run 110 closed the github-channel README hole:** run 101 tagged only the *root* README's CTA, but the `examples/` READMEs (the GitHub dev-eval surface) still linked the marketing host bare → GitHub strips the referrer → those clicks landed as `direct`, not `github`; both example product CTAs now carry `?utm_source=github`, guarded by `readme-attribution-integrity.test.ts` (source-derived, fails on any untagged GitHub-rendered README CTA) | **weekly focus: → ≥ 5 live.** Every published URL carries its ledger `utm_source`; yield read from `/app/admin`, never estimated. Further live-count growth now comes only from the not-yet-live channels (registries R-05 `/reach`, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69 re-measure, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). Run 68 read 86.67% (13/15) w/ consolidation 2/3 — the extra miss was N=15 free-chain noise. **Now diagnosable:** run-69 mismatch table (in the run log via `tee`) pins the sole failure — **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants + full lesson gists
stay in `research/distribution-queue.md` (and `apps/web/src/data/blog.ts`):

- https://nlqdb.com/blog/smoke-test-walks-the-old-ui/ (run 78)
- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51)
- …and 31 more posts — full 37-post registry in `apps/web/src/data/blog.ts` (row #6), live under `/blog/`.

## Last change

**2026-07-24 (run 137)** — **Null run** (step-2 valid outcome): no agent-movable lever cleared the
bar in any lane. **Number moved:** none. **Finding (in place of a delta):**
- **Priority 1 (acquisition/distribution):** weekly-focus row #22 (channels live 4 → ≥ 5) grows only
  through not-yet-live channels — all account-walled human actions (`blocked-by-human` #2–#5), none
  agent-executable; all 4 live channels already utm-keyed (attribution complete). GSC re-pulled **live
  this run**: 6 clicks / 496 impr / pos 17.5 — byte-flat for a **6th consecutive read**. Every winnable
  page maxed (`/solve/count-rows…` 66 impr/pos 7.8, `/vs/metabase/` FAQ-maxed run 125); all other
  queries at 1–6 impr noise, incl. buried agent-memory-benchmark intent queries (pos 52–83). Bottleneck
  is impression breadth (traffic), gated on the human launch — not a page defect, so a new /solve page
  = count not yield (breadth-lever foreclosed since run 127).
- **Priority 2 (UX-flow):** funnel healthy — 07-24 08:34Z acquisition-health cron `success` (walkers
  9/9 + both FLOW-005 transports); strangers 0 (human-gated). No stranger traffic ⇒ no first-10 signal
  to fix; walker not re-runnable here (no `ANTHROPIC_API_KEY`).
- **Priority 3 (meta):** row #17 = 8, re-counted live this run with the pinned grep — 6 gate on
  infra/hardware/upstream dependencies (pk_live issuance, Grafana queue alert, Windows hardware,
  upstream OpenAPI, frontier baseline, self-host container). The other 2 are agent-decidable
  (elements `<nlq-action>` write-token shape, the Suite-A flake) — real levers, but row #17 is
  de-prioritised and no priority-3 waiver beats the founder-set acquisition focus. D4 trim =
  forbidden busywork.
- **Engine:** dark + fresh (baseline `run_at` 07-19, 5 days — under the 7-day dispatch trigger; offline
  levers exhausted).

Structural bottleneck stays the human-gated launch (`blocked-by-human` #1, idle **41 days**) — its age
is the company's real cycle time. **Rule 6 clean** (CI + Security + Release-npm `success` on `main`
`a60bf5b`, verified live this run; last code-SHA `deploy-api` `success` on `c3f0647`; runs 129–136
docs-only, no deploy). **Gates:** change is scorecard-only markdown — `bun run typecheck && lint && test`
unaffected, `main` already green. **Artifact:** queue 2-deep (< 3), no forced publish; dev.to drip N/A
(`DEVTO_API_KEY` absent); null run skips step 3. **KPI (GLOBAL-025):** none advanced; **degrades none**
— `scorecard.md` only, no code / external calls / endpoints.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
