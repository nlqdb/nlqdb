# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-19 → 07-25, founder-set):**
**agentic-frontier EX → ≥ 0.80 (rows #11/#16) via the premium chain
(`SK-LLM-017`, row #20's only open build slot).** Engine stays the pillar
furthest from its [`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor, but
its headline number BIRD (row #8, 0.542) is **dark for the lever** — offline
levers exhausted, external license reply pending — so per the amended `/weekly`
rule the focus is engine's best agent-movable input: build the flag-dark premium
chain and measure it on the `SK-QUAL-022` agentic-frontier smoke (0.693 today;
the ≥ 0.80 Phase-2 criterion is the target). BIRD's revert saga is closed (runs
90/91, flat vs baseline). **Row #15 stays founder-blocked** — its only fix is
arming `FALLBACK2_LLM_API_KEY` (SambaNova, `_e2e-opencheck.yml`), the top
`blocked-by-human.md` bullet.

**Worst number today:** **row #16 Phase-2 exit gate 1/9**; worst engine number is
**row #9 Spider 0.2222** and the weekly-focus **row #8 BIRD 0.542** is resolved
(run 91) + fresh (07-19) with offline levers exhausted — both dark for a single
run. Per **step 0** the two engine/distribution lanes and the priority-1 UX
components lane are all held by open PRs (see below), so **run 96 pulled the next
untaken priority-1 UX-flow lever: the magic-link "Check your inbox" confirmation
(`#signin-sent`) was the only announcement in the whole onboarding flow with no
live-region role** — a screen-reader stranger submitting the magic-link form (the
path that gates anon-DB adoption) heard nothing and keyboard focus was orphaned onto
the now-hidden submit button. Added `role="status"` + a focus move to the heading;
guarded by a source-scan test (row #4). **Step 0 collision map:** open PRs #742
(admin GTM dashboard — `apps/api/src/admin/**` + `apps/web/src/pages/app/admin/**`),
#741 (reach solve page — `data/solve.ts`), #740 (weekly re-point — `weekly.md` +
scorecard), #739 (daily run 95 — `apps/web/src/components/*` a11y), #719 (Infisical
docs draft). This run touched only `apps/web/src/pages/auth/sign-in.astro` +
`apps/web/src/lib/signin-hints.test.ts` + `docs/scorecard.md` — **no overlap**
(scorecard regen is overlap-exempt). **Rule 6:** CI green on `main` `d4a1c69`;
deploy-api/web/canary green on `b46d39e`, deploy-docs/mcp green on `04fa3d0` (run 94
was docs-only ⇒ no new deploy); no red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 02:58Z CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — **re-verified 07-16 remote-D1, newest registration 07-06, none since**. The 428 wall is gone (run 56); acquisition now depends on distribution yield (owned by PR #711) |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13's 223, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel. **Run 92** wired the vague-first-goal recovery copy (`422 infer_failed` → `goal_unclear`); **run 93** fixed the follow-up-before-first-answer path — an aborted in-flight reply no longer spins forever (it settles to a terminal "Cancelled — …"); **run 95** restored a11y parity between the create-result surface and its in-chat twin (`role="status"` + `scope="col"`), so a screen-reader stranger is no longer silently dropped at the "did it work?" moment; **run 96** made the magic-link "Check your inbox" confirmation (`#signin-sent`) an announced live region (`role="status"` + focus move) — it was the only announcement in the flow with no role, so a screen-reader stranger heard nothing on the beat that gates anon-DB adoption (rows #4/#5) |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** (`/vs` 32 + `/solve` 36 + `/blog` **37**; fresh recount 07-19 — `/solve` +3 & `/vs` +1 from merged reach solve/vs pages, `/blog` +1 corrects run 92's 36 undercount). Queue holds **2** (`link-checker-cant-see-your-javascript` [newest], `guard-advertised-capabilities-against-code`) — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** built; **GSC 28d (06-19→07-17, fresh 07-19 pull): 1 click / 452 impr / avg pos 16.3** (the 1 click is the homepage, pos 9.7), sitemap 112 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — page-1 build-vs-buy intent losing the click; a reach-track R-03 solve-page candidate, not a /daily pull). 7d external referrals = 9 (bing 8, github 1 — carried 07-12). Internal links **2,970** + **14 cross-app** (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`; CF `refererHost` carried. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-19 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.542** (270/498 EA, 2 `gold_error`, 1 `exec_error`, 07-19 canonical on **post-revert** main `2b3e4d2`, [run 29670818828](https://github.com/nlqdb/nlqdb/actions/runs/29670818828) — 6 `SK-QUAL-013` windows, `no_sql` 0/500). **Recovered +2.8 pp from the 0.514 `SK-LLM-044` reading; flat vs the re-seeded baseline (Δ −0.40 pp, McNemar b=36/c=34 p=0.452, `regressions: []`) — the run-90 `SK-QUAL-006` trigger is cleared.** Baseline **re-seeded 0.5462 → 0.5422** (07-19; a flat give-back, not a ratcheted regression, `SK-QUAL-005`) | target 0.65 / **Phase 2 floor 0.60** — gap 5.8 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 post-revert canonical on main `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836) → [29683450778](https://github.com/nlqdb/nlqdb/actions/runs/29683450778) → [29683911778](https://github.com/nlqdb/nlqdb/actions/runs/29683911778); 3 `SK-QUAL-013` windows, `no_sql` 0/135, gold_error 0, exec_error 5). **Give-back from the 0.2963 `SK-LLM-044` reading (now reverted, run 90); also −5.2 pp vs the pre-directive 0.2741 — but post-revert `PLAN_DIRECTIVES` is byte-identical to that pre-directive engine, so the drop is free-lane cross-date provider-mix/capacity noise on the *same* engine, not an attributable regression (SK-LLM-044's own Spider gain was McNemar-flat, p≈0.68; its removal is symmetrically flat).** p50 1.52 s / p95 10.9 s. Freshness clock reset 07-11 → 07-19 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-19 run 96):** CI `success` on `main` head `d4a1c69`; deploy-api/web/canary `success` on `b46d39e`, deploy-docs/mcp on `04fa3d0` (run 94 docs-only ⇒ no new deploy); no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run 70 falsified the "clean window" hypothesis:** re-dispatched `abc` on `2b9f8a7` ~3 h after the last free-lane consumer (run 69 memory eval, 07:24Z) — all 3 suites still red, Suite A's anon 2nd `/v1/ask` 240 s-timed-out, **no product regression** (bootstrap recordings passed, no `schema_mismatch`). The free pools (NIM + OpenRouter `:free`) flap intrinsically on a minute timescale ⇒ contention timing was never the cause. **Now dark (rule 8):** only the founder-only independent 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.542, 07-19 post-revert, flat vs baseline — the run-90 regression is cleared); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **15** (fresh grep 07-16 run 86; unchanged since run 78, was 17). Run 78 reclassified 2 decided-deferral ICP bullets (`icp-mining`: Reddit disable [SK-ICP-011], 10th-source refactor pin [P5]) to the canonical "Parked until `<trigger>`" form their 4 siblings already use — honest miscount correction, not a genuinely-open question resolved | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver — run 86 declined the pull: the 15 bullets are genuine deferrals (see _Last change_) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). Runs 32 + 37 + 56 + 59 + 62 + 64 + 72–74 + 76 each found/closed 1 agent-movable gap (most recent: run 76 verified `brew install nlqdb/tap/nlq` live — tap `nlq.rb` sha256 matches the formula, tarball ships the binary). **Standing guards — all three advertised-capability surfaces now closed-world CI-swept across web *and* docs** (run 89 closed the last gap), each deriving its truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (MCP tools from the server's `registerTool(...)` sites, run 64 + **run 89 extended to `apps/docs/src`, `SK-MCP-002`**), `cli-verb-integrity.test.ts` (CLI verbs from the cobra tree, run 74, web + docs prose), and `sdk-method-integrity.test.ts` (SDK methods from the shipped `NlqClient` type, run 88, `SK-SDK-013`, web + docs). All 0 phantom live, negative-tested, false-positive-free. **Trilogy complete** — no advertised-capability surface remains web-only; the category is closed |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) · picker parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal; only genuine remaining slot is the premium chain |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **9/9 + both FLOW-005 transports** ✅ (run-62 branch dispatch [29231826660](https://github.com/nlqdb/nlqdb/actions/runs/29231826660) against prod, exit 0: FLOW-001 3/3 · FLOW-002 3/3 · FLOW-003 3/3 · FLOW-005 walk + stdio both `passed`). Prior fixes: FLOW-001 step 8 asserts the `SK-ANON-012` 401 message-#2 cap (not a 2nd 200); step 7 copy-snippet selector matches the visible accessible name after the diverging `aria-label` was dropped (run 62, WCAG 2.5.3). The run-59 "morph-to-chat gap" is **decided, not a gap** (anon terminus IS the sign-in redirect; SK-WEB-002 chat is post-sign-in) | target 9/9 + both FLOW-005 ✅ **met**. Per-step JSON artifact proxy-gated from the agent container |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 all Neon/infra-gated |
| | Memory-quality eval (`SK-QUAL-023`) | **free-chain EX 93.33% (14/15)** — run 69 re-measure, branch `4679180`, [GHA 29314389843](https://github.com/nlqdb/nlqdb/actions/runs/29314389843); p50 1168 ms / p95 7036 ms, `no_sql` 0. Per-axis: retrieval/forgetting/analytical/**consolidation 3/3**, **temporal 2/3** (sole weak axis). Run 68 read 86.67% (13/15) w/ consolidation 2/3 — the extra miss was N=15 free-chain noise. **Now diagnosable:** run-69 mismatch table (in the run log via `tee`) pins the sole failure — **Q3 temporal, `f.predicate='current_city'`** (hallucinated predicate + missing recency `ORDER BY … LIMIT 1`) | 15 gold-verified questions, 4 axes + analytical; free chain **is** reachable in CI (only the daily container is egress-gated); free-only (frontier lane opt-in); no baseline emitted (measurement, not canonical — SK-QUAL-023). Analytical-vs-vector head-to-head still E-05 infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/smoke-test-walks-the-old-ui/ (run 78 — e2e/measurement lesson, the run-58 walker re-true: pinned-literal acceptance walkers are a regression detector, but a red mixing product-breakage with test-drift costs a full triage — make the fail detail name element + expectation, triage reds on a clock, and gate "re-run the walker on PRs touching a walked surface")
- https://nlqdb.com/blog/green-checkmark-has-a-half-life/ (run 60 — CI/measurement lesson, the row #15 freshness method: when an expensive suite can't run on every push, "passing" is an event not a state — score `pass × freshness` with a linear decay so the number rots until someone re-runs it)
- https://nlqdb.com/blog/ephemeral-staging-persistent-registry/ (run 56 — CI/test-infra lesson, the SK-E2E-007 spin-up purge: an environment is only as ephemeral as the most persistent store that references it)
- https://nlqdb.com/blog/ownership-transfer-outlives-least-privilege/ (run 54 — Postgres multi-tenancy lesson, the SK-ANON-003 adoption ACL gap: an ownership transfer must retarget every authorization store; a catch-all must log the code it swallows)
- https://nlqdb.com/blog/most-active-user-is-your-test-suite/ (run 53 — measurement-hygiene lesson, the funnel bot-filter: a metric that doesn't name its population is measuring your robots; filter at read time)
- https://nlqdb.com/blog/five-fallback-models-one-provider/ (run 51 — CI/engine lesson, the opencheck lane swap: redundancy must cross the failure-domain boundary; the lane, not the model, is the fallback unit)
- …and 30 more posts — full 36-post registry in `apps/web/src/data/blog.ts` (row #6), live under `/blog/`.

## Last change

**2026-07-19 (run 96)** — **Priority-1 UX-flow lever (row #4 onboarding input): the
magic-link "Check your inbox" confirmation is now an announced live region.** Both
engine lanes are dark for a single run (row #8 BIRD resolved+fresh, offline levers
exhausted; row #9 Spider fresh 07-19) and per **step 0** every other pullable lane is
held by an open PR — #742 (admin GTM dashboard), #741 (reach solve page), #740
(weekly re-point), #739 (run 95 create-result a11y), #719 (Infisical draft). The next
untaken priority-1 UX-flow defect: `#signin-sent` (the magic-link success panel,
revealed by toggling `hidden` off) had **no live-region role** — the only
announcement in the whole onboarding flow without one (`#signin-error` is
`role="alert"`; CreateForm error `role="alert"`; chat notice `role="status"`). A
screen-reader stranger submitting the form (the path that gates anon-DB adoption)
heard nothing, and keyboard focus was orphaned onto the now-hidden submit button.
**Change (3 files):** added `role="status"` + a focus move to the `tabindex="-1"`
heading on reveal (`sign-in.astro`), plus a source-scan guard in `signin-hints.test.ts`
(guard-the-guard pins `#signin-error`'s role too). **Number moved — row #4 input:**
the guard fails with the role absent (pre-change) → passes after; web suite **295 →
296 pass**, live-region parity restored. No new decision doc (D5 — cheap to reverse,
per #739's same call). **Gates:** `bun run typecheck` green; lint exit 0 (0 findings
on touched files); web 296 pass / 0 fail; astro check 0 errors. **Step-1:** docs-
ambiguity **15**; surfaces **105**, queue **2**; users **9** / strangers **0**
(07-16); GSC 28d **1/452/16.3** carried (row #7); engine BIRD 0.542 / Spider 0.2222
fresh 07-19. **Artifact:** queue **2** (< 3) → no forced publish; dev.to drip
throttled (8.9h < 20h — no-op); no new draft. **KPI (GLOBAL-025):** **onboarding +
UX** — sign-in success beat now accessible-parity with its siblings; **no KPI
degrades** (2 attrs + 1 focus call + 1 test; no engine/API/funnel logic touched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
