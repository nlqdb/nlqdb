# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**Acquisition — channels live with attributable yield: 2 → ≥ 5 (row #22, now 4).**
Founder directive 2026-07-19 ([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)):
the operating focus is **user acquisition**, measured continuously — product
progress is secondary this cycle. Agent-movable inputs, in order: reach R-05
registry listings (list or park each), the R-04 machine-followable setup guide,
utm-tagging live channels per `SK-GTM-007`, and R-06 (the track's falsifier).
Channel truth lives in
[`research/acquisition-channels.md`](research/acquisition-channels.md); yield
truth on `/app/admin`, never estimated. Premium-chain work (`SK-LLM-017`,
row #20) is pullable only when no acquisition lever is.

**Worst number today:** **row #21 stranger-walker pass rate = 0/9**, verified independently this run by
reading the 07-25 04:19Z prod walk's *job log* (run [30143764445](https://github.com/nlqdb/nlqdb/actions/runs/30143764445),
whose conclusion is pinned green by `SK-STRG-003`): 6 walks fail on the cross-origin goal handoff, 3 on
Turnstile's 428 in headless. Both halves were **PR #820**'s — merged since this run's step-0 snapshot,
so the handoff half is fixed on `main` (`SK-ANON-015`) and the 428 half stays an instrument limit.
Next worst **agent-movable** number was the row #7 *instrument*: the GSC pull saw 158 of 572 page
impressions (27.6%) and named an already-page-1 URL as the top opportunity — fixed this run. Row #16
Phase-2 gate stays 1/9; row #15 = **0.72**; engine (**row #9 Spider 0.2222**, **row #8
BIRD 0.542**) dark + fresh (07-19, 6 d — under the 7-day dispatch trigger). **Top `blocked-by-human`
bullet:** #1 fire the launch sequence (Show HN draft **idle 42 days since 06-13**, kit ready 07-19) —
the only queue action that can move real strangers off 0; its age is the company's real cycle time.
Queue depth **7**: launch (#1), mcp.so / cursor.directory / awesome-mcp / Claude-dir submissions
(#2–#5, account-walled), GLOBAL-039 zone toggle (#6), CI-as-required-check (#7).

**Rule 6 clean** (CI + Security + Release-npm + **all 8 `deploy-*`** `success` on `main` `aad87a7`
07-25 02:24Z, deploys on the last code SHA `97d7712`; gates green locally on `aad87a7` before any edit).
**Step 0** (as of this run — later merges don't backdate it): open PRs **#820** (walkers, `handoff`,
`/solve`+`/vs`+`/agents` pages, `app/new.astro`, anonymous-mode + stranger-test FEATUREs), **#817**
(`astro.config.mjs`, `canonical-redirects*`, `Base.astro`, breadcrumb/itemlist JSON-LD,
`llms.txt`/`rss.xml`/`sitemap.xml`, web-app + solve/comparison decisions), **#819** (reach INDEX,
mcp-server FEATURE, `apps/docs`), #719 (draft). This run touches `scripts/gsc-pull.ts`, the acquisition
ledger and `scorecard.md` — no overlap; the scorecard is step-1 exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (all re-measured live 2026-07-25 ~07:15Z — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | **147 pageloads** (07-18→07-25, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 90 + BingBot 1 ⇒ **real-browser ≈ 56** (Chrome 32 + ChromeMobile 14 + Edge 5 + Firefox 4 + MobileSafari 1). Up from ≈42 last window; no row-#2 signal behind it | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — re-read live remote-D1 07-25, roster byte-identical; no acquisition channel newly live to produce a signal. **Correction:** prior runs read "funnel walkers green" off the cron's *workflow conclusion*, which `SK-STRG-003` pins to success regardless — the 07-24 cron had in fact exited 1 (row #21) |
| 3 | DBs total | **254** (live remote-D1 this run, −1 vs 07-24; synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test. **Attribution instrument re-verified live in prod this run:** `dbsWithSource` = 0 (accrues from first attributable traffic; DBs 254) | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **104 detail pages** (`/solve` 37 + `/vs` 31 + `/blog` 36), counted from the **live prod sitemap** (116 `<loc>` total), not a source grep — correcting the long-standing "105 (`/vs` 32 + `/solve` 36 + `/blog` 37)", wrong in every bucket. Queue holds **2** — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36**; **GSC 28d (06-25→07-23, live pull this run): 6 clicks / 485 impr / pos 17.4** — clicks flat a 9th read. **The whole page distribution is visible for the first time (this run's lever): 100 pages / 572 impr**, vs the prior 20-row clicks-sorted pull's 158 impr = **27.6%**. Strengthen-next by the loop's own rule (impressions, pos > 10): **`/solve/running-total-cumulative-sum-in-sql/` 57 impr / pos 36.0 ← true top target** · `/vs/wrenai` 49 / 15.9 · `/solve/find-rows-with-no-match-in-another-table/` 24 / 15.0 · `/vs/` 18 / 17.9 · `/vs/metabase/` 13 / 10.4 · `/blog/top-n-rows-per-group/` 9 / 21.3. `/solve/count-rows-per-day…` (66 impr / **pos 7.8**) is *already page 1*, yet was recorded here as "the single biggest opportunity" for weeks. **Bare (unslashed) paths carry ≥ 107 impr**: `/vs/wrenai` 49, `/solve` 23, `/vs/vanna` 10, `/solve/pivot-rows-into-columns` 9, `/vs/askyourdatabase` 8, `/vs/cognee` 8 — each splitting signal with its slashed twin, so **#817's bare-path 301 (merged 07-25) is worth ~18× the 6 impr its body could cite**. 5 click-earning pages; sitemap 116 submitted / 0 indexed | `scripts/gsc-pull.ts` now pulls the whole dimension, ranks by impressions, and prints coverage + a strengthen-next list (no silent caps). Total-impression breadth is still the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). Flat vs the re-seeded baseline (Δ −0.40 pp, McNemar p=0.452) — run-90 `SK-QUAL-006` trigger cleared; baseline re-seeded 0.5462 → 0.5422 (`SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836); 3 windows, `no_sql` 0/135, exec_error 5). Give-back from run 90's reverted 0.2963 on a byte-identical engine ⇒ free-lane provider-mix noise, not a regression. p50 1.52 s / p95 10.9 s | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (requests live 07-25; wall-time 07-13 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,169 / 0** (0.00%, 7d live 07-25) | mcp-server 851 req / 0 err; web 10,013 req / 0 err; events-worker 6 req. Deploy health is the Rule-6 line above |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.72** (recomputed from live `main` run history this run). Per suite `pass × freshness`: **sdk 0.95** · **examples 0.95** (both ✅ 07-24) · **mcp 0.97** ([30139911460](https://github.com/nlqdb/nlqdb/actions/runs/30139911460) 07-25 02:09Z ✅ — run 138's stub fix merged, so the suite runs tests again after 11 days of silent `tsc` death) · **opencheck 0** ([30130304331](https://github.com/nlqdb/nlqdb/actions/runs/30130304331) 07-24 ❌ Suite A 1/5 — all 4 failures `TEST_FAILED: rate-limit error` on the **agent** lane after a green pre-flight, i.e. the documented NVIDIA-free-tier saturation flake, not a funnel defect). Now purely opencheck-limited; the three healthy cells decay ~0.14/day until re-dispatched | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md`. Compile-rot can no longer hide between dispatches — `ci.yml`'s `typecheck-e2e` job `tsc`s the three out-of-workspace suites on every PR (execution stays dispatch-only per `SK-E2E-004`) |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (N≈0); MCP in 3+ host apps (0 stranger hosts); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (pinned grep, re-counted after the rebase — the 8 carried since run 130 plus `anonymous-mode`'s new per-file nav-guard question, which arrived with #820) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification + prod sitemap-200 check + `client-nav-integrity.test.ts` (`SK-WEB-022`) over both `location.*` JS navigations **and** static `<a href="/literal">` source literals; dotted assets + dynamic `href={…}` skipped, negative-tested. Run 140 added the `SK-ANON-015` handoff guard to that file. **Note the blind spot row #7 just exposed:** this row is green while ≥ 107 Google impressions land on bare paths that 301 (`SK-WEB-027`) — an *external* inbound link is not an internal one | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). Standing closed-world CI sweeps derive truth from source and name the phantom + file on failure: `mcp-tool-integrity` (`SK-MCP-002`), `cli-verb-integrity` (cobra tree), `sdk-method-integrity` (`SK-SDK-013`). All 0 phantom, negative-tested — no advertised-capability surface is web-only |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0/9** — prod walk 07-25 04:19Z ([30143764445](https://github.com/nlqdb/nlqdb/actions/runs/30143764445)), **verified this run by reading the job log**, not the conclusion (`SK-STRG-003` pins that green on purpose). 6 × FLOW-002/003 fail at step 6 with `nlqdb_draft` `<null>` — the marketing→app cross-origin goal handoff — and 3 × FLOW-001 at step 5 with 428 `challenge_required` (Turnstile declining headless Chromium on a GHA IP; real browsers unaffected). Both halves were PR **#820**'s, merged since this run's step-0 snapshot: the handoff is fixed on `main` (`SK-ANON-015`), so the next prod walk re-measures this row; the 428 half needs `RunState.blocked` (decided, unbuilt — `stranger-test/FEATURE.md`). FLOW-005 walk **6/6** ✅ and stdio **22/22** ✅ (5 tools) in the same run; ttfv p50 859 ms. The `9/9 ✅` carried here since 07-21 was never re-derived from a walk | target 9/9 + both FLOW-005. **Read the job log, never the conclusion** — the artifact is proxy-gated from the agent container and the conclusion is pinned green by design |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live / 0 partial / 1 blocked-by-human / 16 untried** (ledger: organic search + dev.to + npm + GitHub). **Every live channel is utm-keyed** end-to-end: read-through links carry `?utm_source=<ledger key>` (dev.to's API `canonical_url` stays clean for SEO), `source_json` persists on **both** the `/v1/ask` create-arm and `POST /v1/db/connect`, and `readme-attribution-integrity.test.ts` fails on any untagged GitHub-rendered README CTA (root **and** `examples/`). First-touch instrument live 07-19; `dbsWithSource` = 0, accrues from the first attributable visit. MCP registries: official registry published 07-22 ([`com.nlqdb/nlqdb`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.nlqdb/nlqdb) v0.1.1, `websiteUrl` utm-tagged ⇒ in-flight); Glama ingested 07-23, Smithery/PulseMCP not yet surfacing | **weekly focus: → ≥ 5 live.** Yield read from `/app/admin`, never estimated; further growth comes only from the not-yet-live channels (R-05 registries, human-norm venues) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). The sole failure is pinned by the run-69 mismatch table: **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution

**36 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry
is `apps/web/src/data/blog.ts` — the one place the list exists; venue variants and
full lesson gists stay in `research/distribution-queue.md`.

## Last change

**2026-07-25 (run 141)** — **Number moved: row #7's GSC instrument — page impressions it can see,
158/572 (27.6%) → 572/572 (100%).** The acquisition lane's one live channel is organic search, and the
`/daily` + `/reach` rule for spending on it is "strengthen the page with the highest impressions × worst
position". `scripts/gsc-pull.ts` could not see that: it pulled `rowLimit: 20` per dimension, and the GSC
API orders rows **by clicks** — on a property with 6 clicks in 28 days that ordering is noise. Measured
before the change: the page dimension returned **20 of 100 rows and 158 of 572 impressions**, so 72% of
the impression mass was invisible, silently.

What it hid is the point. The top target by the loop's own rule —
**`/solve/running-total-cumulative-sum-in-sql/`, 57 impr at position 36.0** — sat under the cap the whole
time, while this scorecard called `/solve/count-rows-per-day…` (66 impr, **position 7.8**) "the surface's
single biggest impression×position opportunity" for weeks: a page already on page 1, where the remaining
rank upside is smallest. Also newly visible: **≥ 107 impressions land on bare, unslashed paths**
(`/vs/wrenai` 49 at pos 15.9, `/solve` 23, `/vs/vanna` 10, …), each splitting signal with its slashed
twin — making **#817**'s bare-path 301 (merged 07-25) worth ~18× the 6 impressions its body could cite.

Fix (one file): pull the whole dimension, rank by impressions, print `rows / impr` coverage plus the
share the printed slice covers, warn if the row cap is ever hit, and emit a **Strengthen next** section
so the selection rule is computed rather than eyeballed. **Re-measured the same way after:** `## Top
pages — 100 rows / 572 impr; top 20 by impressions = 66% of them`. No new decision record — the trap is
closed in code, so documenting it would fail D5.

**Other lanes:** funnel + GSC + CF RUM re-measured live (strangers **0**; DBs 254; `dbsWithSource` 0).
Row #21 corrected **9/9 → 0/9** by reading the walk's *job log* instead of its pinned-green conclusion —
independent confirmation of #820's finding, whose fix (merged since) is not duplicated here. Row #15 rose
0.50 → **0.72** with no action here (run 138's mcp fix merged; green on `main` 07-25 02:09Z). Row #6
recounted from the live prod sitemap: **104** — matching `solve.ts` 37 + `competitors.ts` 31 + `blog.ts`
36. Row #17 is **9**, not 8, once #820's new open question landed. Engine dark + fresh (07-19, 6 d).
Queue 2-deep (< 3) ⇒ no forced publish, no new draft; the dev.to drip self-throttled — the expected
no-op. **Gates:** `typecheck && lint && test` green locally (20 packages); `main` was green first.
**D4:** scorecard held under 20 KB by D5-trimming per-run history out of rows #8–#9, #13, #16, #19, #22,
the memory-eval row and the shipped-distribution list (the registry is `blog.ts`). **KPI (GLOBAL-025):** advances **onboarding/distribution** — the
acquisition lane can now aim at the pages that actually have clicks to win; **degrades none** (one
measurement script, no runtime code, endpoint, external call, or bundle change).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
