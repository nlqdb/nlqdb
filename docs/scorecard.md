# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-11 → 07-18):** **row #15 E2E freshness →
1.0**. But row #15 is **firmly dark (rule 8)** — the founder-only independent
3rd free-LLM pool is the confirmed durable blocker (run 70 falsified the
"clean window" hypothesis). BIRD (row #8, 0.546 < the 0.60
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor) is also
**dark for the lever** (offline levers exhausted, SC dead #619, frontier-lens
closed run 15; corrected-set blocked on uiuc-kang-lab #7 license reply, filed
07-07, no response). **/weekly should re-point the focus off #15** while that
secret is unset.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; 9 users = 4 founder/company + 5 test/dev, newest reg 07-06, none
since — lagging, moved only through agent-controllable inputs).

**Run 89 = null run.** No lever clears the bar: engine egress-gated here
(`SK-QUAL-023`); E2E freshness dark (founder 3rd pool); UX-flow rut-blocked
(rule 7, runs 80–85) and unmeasurable in-container; distribution content
reach-owned + publish queue 2-deep (< 3); integrity guards (rows #18/#19)
would be monoculture — #18 was run 87, #19 is in open PR #726. Fresh GSC pull
(07-18) surfaced one finding (row #7): a blog post indexed on `app.nlqdb.com`
rather than canonical `nlqdb.com` — already mitigated by the correct
`Astro.site` canonical tag; a host redirect is Cloudflare-console (founder)
territory, low marginal value. **Step 0:** open PRs #726 (run 88 SDK-method
guard, row #19), #727 (reach R-02 competitors.md), #719 (Infisical research
draft) — zero overlap with this scorecard-only run. **Rule 6:** CI green on
`main` (typecheck green post-`bun install`; the pre-install red is the run-71
env artifact); deploy-web latest on `main` (run 87) `success`. No
red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads raw (07-06→07-13); walker filter (run 12) ⇒ **real-browser ≈ 49** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | **0** | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — re-verified 07-16 remote-D1, newest reg 07-06, none since. 428 wall gone (run 56); acquisition now depends on distribution yield |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13, synthetic walker/preview — previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 remote-D1, `SK-ONBOARD-007`). 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12, founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **100** (`/vs` 31 + `/solve` 33 + `/blog` 36 built; raw data-file 37/35 include unbuilt drafts) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36** built; **GSC 28d (06-18→07-16, fresh 07-18): 1 click / 455 impr / pos 16.4**, sitemap 112 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — reach-track R-03 candidate). 7d referrals = 9 (bing 8, github 1, carried). Internal links 2,970 + 14 cross-app (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18). **Finding (07-18):** GSC shows `app.nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/` (pos 8, 1 impr) — blog indexed on the app subdomain; canonical already points to `nlqdb.com` (Astro.site), so Google should consolidate; host redirect = Cloudflare-console (founder) | GSC via `scripts/gsc-pull.ts`. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081), `no_sql` 0/500). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; dark for lever |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809)→[29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (07-13 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err (secret-drift re-provisioning tracked in `blocked-by-human.md`). **Deploy health (07-18):** CI green on `main`; deploy-web latest (run 87) `success`; run-86 all-green deploy verification (9 `deploy-*` + `release-npm` + `security`) still holds — merges since (#721–#725) are path-filtered/web-only |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0; opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED, pass=0 zeroes it ⇒ mean 0.75). Run 70 falsified the "clean window" hypothesis: re-dispatched ~3 h after the last free-lane consumer, all 3 suites still red (anon 2nd `/v1/ask` 240 s-timed-out), **no product regression**. The free pools flap intrinsically on a minute timescale. **Dark (rule 8):** only the founder-only independent 3rd free pool lifts it | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry (instrumented, N≈0); MCP in 3+ host apps (1 founder host); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **15** (fresh grep 07-18; unchanged since run 78) | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching (case-insensitive) `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver — the 15 are genuine deferrals |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: 121 pages, 2,970 internal + 14 cross-app links). Coverage: built-output `href`/`src` sweep + cross-app subdomain verify (run 61) + prod sitemap-200 (run 72) + `client-nav-integrity.test.ts` (run 77, SK-WEB-022) guarding `location.*` JS navigations **+ static `<a href>` source literals** (run 87, after the legal-page bare-path 307s). **Known root cause:** `check:links` (built-output sweep) is not wired into CI — the SK-WEB-022 source-literal guard covers it between manual daily sweeps | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0 open** — run 76 verified `brew install nlqdb/tap/nlq` is real (tap carries `nlq.rb` v0.1.12, asset HTTP 200 + sha256 match). Runs 32/37/56/59/62/64/72/73/74/76 each closed 1 agent-movable gap. **Standing guards:** `mcp-tool-integrity.test.ts` (run 64, MCP catalog), `cli-verb-integrity.test.ts` (run 74/76, 15 cobra verbs swept across web + docs prose). **In flight (PR #726, run 88):** SDK-method surface guard (`SK-SDK-013`) — the last un-guarded advertised capability | claim-vs-reality on shipped surfaces + docs; target 0 **met** |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-62 branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) against prod, exit 0). FLOW-001 step-8 asserts the `SK-ANON-012` 401 cap; run-62 closed the step-7 copy-snippet false-green (aria-label diverged from accessible name → dropped, selector widened) | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact isn't downloadable from the agent container (proxy-gated) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/consolidation 3/3, **temporal 2/3** (sole weak axis, Q3 `current_city` hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain reachable in CI (only the daily container is egress-gated); no baseline emitted (SK-QUAL-023) |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/smoke-test-walks-the-old-ui/ (run 78 — e2e/measurement: pinned-literal acceptance walkers are a regression detector; make fail detail name element + expectation, triage reds on a clock)
- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60 — when an expensive suite can't run every push, "passing" is an event not a state; score `pass × freshness`)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56 — an environment is only as ephemeral as the most persistent store that references it)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54 — an ownership transfer must retarget every authorization store)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53 — a metric that doesn't name its population is measuring your robots; filter at read time)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51 — redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- …and 30 more posts — full 36-post registry in `apps/web/src/data/blog.ts` (row #6), live under `/blog/`.

## Last change

**2026-07-18 (run 89)** — **Null run: no lever cleared the bar; step-1
scorecard refresh only.** Engine egress-gated in-container (`SK-QUAL-023`);
E2E freshness dark (rule 8, founder 3rd free-LLM pool); UX-flow rut-blocked
(rule 7, runs 80–85) and unmeasurable in-container; distribution content
reach-owned + publish queue 2-deep (< 3, no forced publish); integrity guards
(rows #18/#19) would be monoculture — #18 was run 87, #19 is in open PR #726.
**Finding (fresh GSC pull 07-18):** `app.nlqdb.com/blog/postgres-validator-rejects-valid-clickhouse-sql/`
is indexed on the app subdomain (pos 8, 1 impr) — the marketing site is
served on both hosts, but the `Astro.site`→`nlqdb.com` canonical tag already
covers dedup, so Google should consolidate; a host-level redirect is
Cloudflare-console (founder) territory with low marginal value → recorded, not
escalated. **Step-1 refresh:** CI green on `main` (typecheck green
post-`bun install`; pre-install red is the run-71 env artifact); deploy-web
latest (run 87) `success`; GSC 28d **1 click / 455 impr / pos 16.4** (fresh
07-18, unchanged); indexable surfaces **100**; users **9** / strangers **0**
carried (07-16); docs-ambiguity **15** (fresh grep). Scorecard net-shrunk
20.4 KB → under the 20 KB D4 cap (compressed accreted run-history prose in the
preamble + rows #7/#15/#18/#19/#21 per the no-changelog rule). **Artifact
(step 3):** skipped — a null run ships only the scorecard update; the queue
(2 drafts) + dev.to drain resume on the next non-null run. **KPI
(GLOBAL-025):** none moved (null run); none degraded (scorecard-only).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
