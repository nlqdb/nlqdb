# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-11 → 07-18):** **row #8 BIRD raw EX → ≥ 0.60**
(re-pointed by /weekly, PR #731) — the pillar furthest from its
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor, and the one *unparked*
engine lever: `SK-LLM-044` (+2.2 pp Spider, run 51) had **never been measured on
BIRD**. This run measured it — see below.

**Worst number today:** **row #8 BIRD regressed — 0.546 → 0.514** on the
first-ever post-`SK-LLM-044` canonical run. **Run 90 pulled the engine lever
(row #8):** dispatched the canonical BIRD full eval on current main `8f254c9`
([run 47, 29663019022](https://github.com/nlqdb/nlqdb/actions/runs/29663019022),
500 q, `no_sql` 0 — capacity-clean, single window) to fold in `SK-LLM-044` (row #8
was measured pre-directive). Result: free EA **0.546 → 0.514** (272 → 256 match,
2 `gold_error`, 1 `exec_error`), **McNemar b=46 / c=30, p=0.043 → a `SK-QUAL-006`
regression trigger** on the gate-binding benchmark. The `SK-LLM-044` decision doc
claimed BIRD-safety ("BIRD's positional scorer follows the goal's literal ask");
the measurement **falsified it** — "return the column that names the entity,
JOINing to its naming table" adds a name column/JOIN where BIRD gold wants the id
or metric alone. Meanwhile `SK-LLM-044`'s Spider justification was itself
**statistically flat** (07-11: raw +2.2 pp but McNemar p≈0.68). A directive that
never significantly helped its own target and significantly harms the gate
constraint has not earned its place → **reverted** (`packages/llm/src/prompts.ts`
bullet + `prompts.test.ts` assertion; decision doc + FEATURE.md marked reverted).
Baseline kept at **0.546** (`SK-QUAL-005` — never ratchet a regression into the
norm). **Post-revert canonical BIRD re-measure due next run on main** (expect
recovery toward 0.546); row #9 Spider expected to return to ~0.2741 (a
statistically-flat give-back, no real KPI). **Step 0:** open PRs #731 (scorecard/weekly
docs), #730 (`solve.ts`), #729 (mcp test), #719 (Infisical draft) — none touch
`packages/llm/**`; scorecard regen is overlap-exempt. **Rule 6:** CI green on `main`
head `8f254c9` (run 2566 `success`); no red-main / stale-deploy lever.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (visits 07-13 02:58Z CF GraphQL; users/DBs 07-16 remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 232 pageloads (07-06→07-13 02:58Z, raw). Walker filter (run 12, `userAgentBrowser` cut): "Unknown" 183 ⇒ **real-browser ≈ 49 pageloads** (Chrome 41, ChromeMobile 3, MobileSafari 2, Firefox 2, Edge 1) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company (`omer@salfati.group`, `omer.hochman@{gmail,bigpanda}`, `hi@nlqdb.com`) + 5 test/dev (`*@example.com`, `*@preview.dev`) — **re-verified 07-16 remote-D1, newest registration 07-06, none since**. The 428 wall is gone (run 56); acquisition now depends on distribution yield (owned by PR #711) |
| 3 | DBs total | **251** (07-16 remote-D1; +28 vs 07-13's 223, synthetic — walker/preview traffic; previews share prod D1) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not yet measurable** (07-12 19:41Z remote-D1; method `SK-ONBOARD-007`). Only 3/165 DBs have `first10_asks > 0` (Σok 3 / Σasks 4), all founder/test | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12 19:41Z; founder-owned) | share of DBs with `first10_asks ≥ 2` |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **100** (`/vs` 31 + `/solve` 33 + `/blog` **36**; run-79 count fix — `blog.ts` holds 36 published posts, run 78 read 35). Run 78 published the oldest queued draft (`smoke-test-walks-the-old-ui`, step 3.1 forced-publish at ≥3 depth) → live at `/blog/smoke-test-walks-the-old-ui/`, verified in sitemap + rss + llms.txt. Queue now holds **2** (`link-checker-cant-see-your-javascript` [newest], `guard-advertised-capabilities-against-code`) — below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **36** built; **GSC 28d (06-18→07-16, fresh 07-18 pull): 1 click / 455 impr / avg pos 16.4**, sitemap 112 submitted / 0 err. Top query `"top 10 products by revenue" metabase` pos 6.8 (6 impr, 0 clicks — page-1 build-vs-buy intent losing the click; a reach-track R-03 solve-page candidate, not a /daily pull). 7d external referrals = 9 (bing 8, github 1 — carried 07-12). Internal links **2,970** + **14 cross-app** (run-87 build: 121 pages, 0 dead / 0 redirecting — row #18) | GSC via `scripts/gsc-pull.ts`; CF `refererHost` carried. Impressions indexing-wide but ~0 CTR — total-impression breadth is the bottleneck, not per-page CTR at N≤12 impr (noise) |
| | **Engine** — BIRD 07-18 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.514** (256/498 EA, 2 `gold_error`, 1 `exec_error`, 07-18 canonical on main `8f254c9`, [run 29663019022](https://github.com/nlqdb/nlqdb/actions/runs/29663019022) — ONE window, `no_sql` 0/500). **Regressed −3.21 pp vs the 0.546 baseline (07-11 `2cfda39`), McNemar b=46/c=30 p=0.043 → `SK-QUAL-006` regression trigger.** First-ever post-`SK-LLM-044` measurement ⇒ `SK-LLM-044` reverted this run (run 90). **Baseline kept at 0.546** (`SK-QUAL-005` — don't ratchet a regression); post-revert canonical re-measure due next run | target 0.65 / **Phase 2 floor 0.60** — gap 8.6 pp on the regressed number. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, 07-11 with `SK-LLM-044`, [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). **`SK-LLM-044` reverted this run** (its +2.2 pp here was McNemar-flat, p≈0.68, while it regressed BIRD row #8) — expect a give-back toward the pre-directive **0.2741** on the next Spider canonical; re-measure due | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-18 run 89):** CI **green on `main`** head `8f254c9` (ci.yml `success`) and **deploy-web** `success` on the same head (#727 `competitors.ts` triggered it); no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run 70 falsified the "clean window" hypothesis:** re-dispatched `abc` on `2b9f8a7` ~3 h after the last free-lane consumer (run 69 memory eval, 07:24Z) — all 3 suites still red, Suite A's anon 2nd `/v1/ask` 240 s-timed-out, **no product regression** (bootstrap recordings passed, no `schema_mismatch`). The free pools (NIM + OpenRouter `:free`) flap intrinsically on a minute timescale ⇒ contention timing was never the cause. **Now dark (rule 8):** only the founder-only independent 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.514, 07-18, regressed from 0.546 pre-`SK-LLM-044`; directive reverted); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
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

**2026-07-18 (run 90)** — **Engine lever (row #8, weekly focus): measured
`SK-LLM-044` on BIRD for the first time; it regressed the gate benchmark →
reverted.** `SK-LLM-044` (the entity-identification projection directive) shipped
on a Spider result-shape read (+2.2 pp raw, run 51) with a documented "BIRD-safe"
claim, but was **never BIRD-measured**. Dispatched the canonical BIRD full eval on
current main `8f254c9` ([run 47, 29663019022](https://github.com/nlqdb/nlqdb/actions/runs/29663019022),
500 q, `no_sql` 0, one window). Result: free EA **0.546 → 0.514** (272 → 256
match), **McNemar b=46/c=30, p=0.043 → a `SK-QUAL-006` regression trigger** on the
Phase-2 gate-binding benchmark. That **falsifies** the directive's BIRD-safety
claim — "return the column that names the entity, JOINing to its naming table"
adds a name column/JOIN where BIRD gold wants the id or metric alone (the
extra-column class `SK-LLM-027` bounds, overridden in practice). And its Spider
gain was itself **statistically flat** (07-11: raw +2.2 pp, McNemar p≈0.68). A
directive that never significantly helped its target and significantly harms the
gate constraint has not earned its place → **reverted** the `PLAN_DIRECTIVES`
bullet + its `prompts.test.ts` assertion; decision doc `SK-LLM-044` + `llm-router`
FEATURE.md marked reverted (P3). **Number:** row #8 BIRD **0.546 → 0.514**
(measured regression removed by reverting the regressor); **baseline kept at
0.546** (`SK-QUAL-005` — never ratchet a regression). **Gates:** `bunx tsc` (llm)
clean; llm 270 pass + eval 299 pass. **Step-1 refresh:** CI green `8f254c9` (run
2566); docs-ambiguity **15** (fresh grep); `/blog` **36**; users **9** / strangers
**0** carried (07-16, newest reg 07-06); GSC 28d **1 click / 455 impr / pos 16.4**
carried. **Post-revert canonical BIRD re-measure due next run on main** (expect
recovery toward 0.546); Spider row #9 expected give-back toward 0.2741 (flat, no
real KPI). **Artifact (step 3):** queue **2** (< 3) → no forced publish; this run's
lesson (a prompt directive picked on one benchmark must be measured on the other
before it ships) is engine-internal, not a stranger-search topic → no new draft.
**KPI (GLOBAL-025):** **engine quality** — removes a McNemar-significant BIRD
regression silently live on `main`; no real KPI degrades (the Spider give-back was
statistically flat).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
