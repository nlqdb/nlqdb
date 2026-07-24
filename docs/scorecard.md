# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22).**
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
is pullable only when no acquisition lever is.

**Worst number today:** **row #15 E2E manual-suite freshness — recomputed to a true 0.00**, not the
"≈0.75" three prior runs implied (every suite's last main success was 07-13/07-17, all past the 7-day
decay). Run 138 moved it to **0.50** and found the cause of the mcp cell: the suite had been failing in
`tsc` since 07-13, testing nothing. Row #16 Phase-2 exit gate stays 1/9; worst engine numbers
(**row #9 Spider 0.2222**, **row #8 BIRD 0.542**) are dark + fresh (07-19, 5 days), offline levers
exhausted. **Top `blocked-by-human` bullet:** #1 fire the launch sequence (Show HN draft **idle 41 days
since 06-13**, kit ready since 07-19) — the only queue action that can move real strangers from 0; its
age is the company's real cycle time (rule: human-queue). Queue depth **6** ranked bullets: launch (#1),
mcp.so / cursor.directory / awesome-mcp / Claude-dir submissions (#2–#5, all account-walled), the
GLOBAL-039 zone toggle (#6, lowest rank — internal-integrity yield).

**Rule 6 clean** (CI + Security + Release-npm `success` on `main` `a60bf5b` — 07-24 18:12Z; latest
`deploy-api` `success` on the last code SHA `c3f0647`; runs 129–137 docs-only, no deploy). **Step 0:**
open PRs #813 (run 137 null, `scorecard.md` — step-1 exempt), #814 (reach null, reach INDEX), #719
(draft Infisical); run 138 touches `tests/e2e/mcp`, `ci.yml`, the e2e-coverage FEATURE, the
distribution queue and `scorecard.md` — no overlap with #813/#814 beyond the step-1-exempt scorecard.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits + users/DBs fresh 07-22 remote-D1 + CF GraphQL) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **212 pageloads** (07-15→07-22, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 168 + BingBot 2 ⇒ **real-browser ≈ 42** (Chrome 33 + Edge 8 + MobileSafari 1). Flat vs 07-13's ≈49 | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — last live remote-D1 read run 138 (07-24 22:15Z: 9 emails re-listed), unchanged — no acquisition channel newly live to produce a signal; funnel walkers green via the 07-24 08:34Z acquisition-health cron. The 428 wall is gone (run 56); acquisition now depends on distribution yield |
| 3 | DBs total | **255** (07-24 live remote-D1, flat vs 07-23; synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test. **Attribution instrument re-verified live in prod 07-24 run 138:** `dbsWithSource` = 0 (accrues from first attributable traffic; DBs 255 flat) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. The stranger create→ask→first-answer path is hardened each run; per-run detail in `git log` |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; fresh recount 07-19 — `/solve` +3 & `/vs` +1 from merged reach solve/vs pages, `/blog` +1 corrects run 92's 36 undercount). Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-24→07-22, re-pulled live 07-24 run 138, byte-flat 7th consecutive read): 6 clicks / 496 impr / avg pos 17.5** — top winnable page `/solve/count-rows-per-day-including-missing-dates/` **66 impr / pos 7.8** (surface's single biggest impression×position opportunity, already on-page-maxed; run 128 fixed its lone defect — internal-ID leak). 4 click-earning pages: `/security/hall-of-fame/`, homepage, `/architecture/`, `/blog/bird-gold-noise-distinct/`. sitemap 116 submitted / 0 err. Largest single-query impression is 6 (`"top 10 products by revenue" metabase`, pos 6.8 → `/vs/metabase/`). 7d external referrals = 9 (bing 8, github 1). Internal links **2,970** + **14 cross-app** (0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on **post-revert** main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Recovered +2.8 pp from the 0.514 `SK-LLM-044` reading; flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452) — run-90 `SK-QUAL-006` trigger cleared. Baseline re-seeded 0.5462 → 0.5422 (07-19, `SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); 3 `SK-QUAL-013` windows, `no_sql` 0/135, exec_error 5). Give-back from the reverted 0.2963 `SK-LLM-044` reading (run 90); post-revert engine is byte-identical ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s. Freshness reset 07-19 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window. Deploy health tracked in the Rule-6 line above (all `success` on `main`) |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.50** (07-24 run 138, all four suites dispatched + recomputed from live run history). Per suite `pass × freshness`: **sdk 1.0** ([30130254208](https://github.com/nlqdb/nlqdb/actions/runs/30130254208) 07-24 ✅) · **examples 1.0** ([30130272149](https://github.com/nlqdb/nlqdb/actions/runs/30130272149) 07-24 ✅) · **mcp 0** ([30130270721](https://github.com/nlqdb/nlqdb/actions/runs/30130270721) 07-24 ❌ — `tsc` error, **not a product break**: the suite has died in typecheck since 07-13, so it compiled and ran **zero** tests for 11 days; fixed + verified green this run on branch [30130543841](https://github.com/nlqdb/nlqdb/actions/runs/30130543841) 4/4, returns to 1.0 on the first post-merge `main` dispatch) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) 07-24 ❌ Suite A 1/5 — all 4 failures are `TEST_FAILED: rate-limit error` on the **agent** lane after a green pre-flight, i.e. the documented NVIDIA-free-tier saturation flake, not a funnel defect). **Prior reading was wrong, not just stale:** the "sdk/mcp/examples ≈1.0" cell implied ≈0.75 while every suite's last `main` success was 07-13 (11 d) or 07-17 (7 d) ⇒ true value **0.00** | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md`. Compile-rot can no longer hide between dispatches — `ci.yml`'s `typecheck-e2e` matrix `tsc`s the three out-of-workspace suites on every PR (execution stays dispatch-only per `SK-E2E-004`) |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542, 07-19 post-revert, flat vs baseline — the run-90 regression is cleared); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **8** (re-verified 07-24 run 131, same pinned grep, unchanged since run 130's 12 → 8 — run 130 reclassified the CLI device-flow / `keys rotate` / `--preset` and db-adapter `engine?`-parity bullets **Parked until <trigger>**; each cites a fixed decision record (`SK-AUTH-004`/`SK-APIKEYS-005`/E-01·`SK-HDC-020`/`GLOBAL-003`) and is a mechanical build task, not an open design choice — decided deferrals, not open questions) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). **Standing guards — all three advertised-capability surfaces closed-world CI-swept across web *and* docs**, each deriving truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (`registerTool(...)` sites, `SK-MCP-002`), `cli-verb-integrity.test.ts` (cobra tree), `sdk-method-integrity.test.ts` (shipped `NlqClient` type, `SK-SDK-013`). All 0 phantom live, negative-tested. **Trilogy complete** — no advertised-capability surface remains web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (daily acquisition-health cron run 67 [29815040423](https://github.com/nlqdb/nlqdb/actions/runs/29815040423) against prod, 07-21 08:37Z: verify-flows all-green, stranger-test FLOW-001/002/003 exit 0, FLOW-005 walk 6/6, FLOW-005 stdio 22/22 — 5 tools, no legacy verbs). The run-59 "morph-to-chat gap" is **decided, not a gap** (anon terminus IS the sign-in redirect; SK-WEB-002 chat is post-sign-in) | target 9/9 + both FLOW-005 ✅ **met**. Freshness re-armed 07-21 (GLOBAL-032 7-day rule); per-step JSON artifact proxy-gated from the agent container |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** (ledger: organic search + dev.to + npm + GitHub). **Every live channel is utm-keyed** — the attribution requirement is met end-to-end: read-through links carry `?utm_source=<ledger key>` (dev.to's API `canonical_url` stays clean for SEO), `source_json` persists on **both** the `/v1/ask` create-arm and `POST /v1/db/connect` (a connect-first signup on the github/npm channels is attributable, not `untracked`), and `readme-attribution-integrity.test.ts` fails on any untagged GitHub-rendered README CTA — root **and** `examples/`, which GitHub strips the referrer from. First-touch instrument live 07-19 (`databases.source_json` + `/app/admin` sources; prod migration 0024 applied, verified 07-22); `dbsWithSource` = 0, accrues from the first attributable visit. MCP registries: official registry **published 07-22** ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1 active, `websiteUrl` utm-tagged → ledger row #3 in-flight); crawl-fed Smithery/PulseMCP still not surfacing, Glama ingested 07-23 | **weekly focus: → ≥ 5 live.** Yield read from `/app/admin`, never estimated. Further live-count growth comes only from the not-yet-live channels (registries R-05 `/reach`, human-norm venues) |
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

**2026-07-24 (run 138)** — **Number moved: row #15 E2E manual-suite freshness, 0.00 → 0.50.**
The row's prior cell was wrong, not merely stale: it asserted "sdk/mcp/examples ≈1.0" (implying ≈0.75)
while every suite's last `main` success was 07-13 (11 d) or 07-17 (7 d) — all four cells were already
decayed to 0. Dispatched all four suites on `main` to recompute from reality: **sdk ✅ · examples ✅ ·
mcp ❌ · opencheck ❌**.

The mcp ❌ is the real find: `tests/e2e/mcp` has died in `tsc` on **every** dispatch since 07-13 —
`stubClient`'s `getModels` returned `{presets, models}` after the SDK's `ModelCatalog` gained
`free`/`providers` — so the MCP protocol suite compiled and ran **zero** tests for 11 days while
looking merely "not recently dispatched". Fixed the stub (verified green on branch,
[30130543841](https://github.com/nlqdb/nlqdb/actions/runs/30130543841), 4/4) and closed the structural
hole: `tests/e2e/{sdk,mcp,examples}` live outside the root workspace, so root `bun run typecheck` never
covered them — `ci.yml` now has a compile-only `typecheck-e2e` matrix. `SK-E2E-004` is unchanged and
gains one clarifying clause: dispatch-only bounds *execution*, not compilation ($0, no secrets, no Neon
branch). Row #15 returns to 0.75 on the first post-merge `main` dispatch.

opencheck's ❌ is **not** a product defect: pre-flight picked a healthy agent model, then 4/5 Suite-A
tests died on `TEST_FAILED: rate-limit error` from the NVIDIA free agent lane — the saturation flake
`opencheck-operations.md` documents. Not pulled this run (a bigger lane costs money ⇒ rule 4).

**Other lanes:** acquisition — step 3.3 drained one dev.to venue variant autonomously
([live post](https://dev.to/omer_hochman/you-dont-need-a-backend-to-store-form-submissions-you-need-a-place-to-ask-how-many-3kec),
run-106 queue line updated); GSC re-pulled live, byte-flat 7th read (6 clicks / 496 impr / pos 17.5),
strangers re-read live = 0. Engine dark + fresh (07-19). Queue 2-deep (< 3) ⇒ no forced publish; no new
draft (`distribution-queue.md` is at the D4 cap and drafting is optional).
**Gates:** `bun run typecheck && lint && test` green locally; **D4:** scorecard net-shrank 20154 → 20140 B by compressing row #22's accumulated per-run changelog (D5), e2e-coverage FEATURE and the
distribution queue each net-shrunk. **KPI (GLOBAL-025):** advances **engine quality**'s verification
floor + **UX** (the MCP surface is tested again, not silently untested); **degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
