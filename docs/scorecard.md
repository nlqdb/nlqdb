# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number (2026-07-11 → 07-18):** **row #15 E2E freshness →
1.0** — close the opencheck stale-fixture red and keep all four suites
fresh. **Why:** it is the worst *agent-movable* number outside the daily
engine lane, which already pulls row #9 Spider (run 51, #664). BIRD
(row #8, 0.546 < the 0.60
[`GLOBAL-025`](decisions/GLOBAL-025-north-star.md) floor) is
**dark for the lever** — offline levers exhausted, SC dead (#619),
frontier-lens closed (run 15); the only remaining path, the corrected-set,
is blocked on an external maintainer's license reply (uiuc-kang-lab #7,
filed 07-07, no response), so no single run can move it — `SK-QUAL-005`'s
engine-work mandate stands lever-blocked and re-binds the focus once any
engine lever unparks. Row #15 is **firmly dark (rule 8)** — the founder-only
independent 3rd free-LLM pool is the confirmed durable blocker (run 70
falsified the "clean window" hypothesis; full detail + run link in row #15).
/weekly should re-point the focus off #15 while that secret is unset.

**Worst number today:** real strangers reaching a first answer = **0**
(row #2; 07-16 remote-D1 pull carried — 9 users = 4 founder/company + 5
test/dev, newest registration 07-06, none since; lagging, moved only through
agent-controllable inputs). **Run 88 pulled a product-readiness / claim-integrity
lever (row #19):** the SDK method surface (`client.*` / `NlqClient.*`) was the
**last un-guarded advertised capability** — CLI verbs (run 74) and MCP tools
(run 64) each already had a standing CI guard, but a phantom `client.foo(...)` in
a web/docs snippet would throw on a stranger's first SDK call (the run-62
`nlqdb_recall` failure mode, `GLOBAL-003`) and slip CI. Built
`sdk-method-integrity.test.ts` (`SK-SDK-013`): sweeps `apps/web/src` +
`apps/docs/src` against the shipped `NlqClient` type (derived from
`packages/sdk/src/index.ts`, pinned). **0 phantom live** (18 distinct refs all
shipped); negative-tested + false-positive-free. This is a different lever
category from the recent runs — web-UX rut-blocked (rule 7, runs 80–85);
surface-integrity pulled last run (87); engine unmeasurable here (`SK-QUAL-023`,
egress-gated). **Step 0:** only PR #719 open (Infisical research, `docs/research/`)
— zero overlap with the SDK guard / `apps/web` / `packages/sdk` / docs-features.
**Rule 6:** CI green on `main` head `4afc71b` (latest merge a docs audit; ci.yml
`success`); no red-main / stale-deploy lever. **Engine freshness:** rows #8/#9
measured 07-11 = 7 days old (at the alert boundary, not yet >7); a re-dispatch is
due once this PR merges (avoid churning the SHA-keyed `SK-QUAL-013` checkpoint
mid-cycle).

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
| | **Engine** — BIRD 07-11 · Spider 07-11 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.546** (272/498 EA, 2 `gold_error`, 07-11 canonical on main `2cfda39`, [run 29144102081](https://github.com/nlqdb/nlqdb/actions/runs/29144102081) — completed in ONE window, `no_sql` 0/500). Δ +2.01 pp vs 07-05, McNemar b=31/c=41, `regressions: []`. Baseline re-seeded. Measured pre-`SK-LLM-044`; next canonical re-verifies | target 0.65 / **Phase 2 floor 0.60** — gap 5.4 pp. Offline levers exhausted; SC dead (#619); frontier-lens closed (run 15) |
| 9 | Spider raw EX | **0.2963** (40/135, `no_sql` 0/135, exec_error 3, gold_error 0 — 07-11 canonical on `6e1725c` with `SK-LLM-044`, nine-window `SK-QUAL-013` resume [29160009809](https://github.com/nlqdb/nlqdb/actions/runs/29160009809) → [29164092490](https://github.com/nlqdb/nlqdb/actions/runs/29164092490)). Was 0.2741 | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is its source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004) — flat vs 07-02) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06 run 15, `SK-QUAL-022`). persona-bench −4.35 pts (07-09, one-question noise at N=23) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69–0.70 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-13 02:58Z pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 4,974 / 0 (0.00%) | mcp-server 473 req / 0 err; events-worker 31 req; canary 4 req / 0 err this window (secret-drift re-provisioning still tracked in `blocked-by-human.md`). **Deploy health (07-18 run 87):** CI **green on `main`** head `ba7bbde` (run 2552 `success`); merges since 07-16 (#721/#722 docs/pivot) are path-filtered away from `deploy-*`, so the run-86 all-green deploy verification (9 `deploy-*` + `release-npm` + `security`) still holds; no red-main / stale-deploy lever |
| 13 | nlqdb-api wall-time p50 / p95 | p50 ≈ 0.61 s / p95 ≈ 1.70 s | mcp-server p95 ≈ 755 ms this window; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **≈ 0.75** (sdk/mcp/examples ≈1.0 each; **opencheck's latest main run [29324716801](https://github.com/nlqdb/nlqdb/actions/runs/29324716801) (run 70) FAILED**, pass=0 zeroes it ⇒ mean 0.75). **Run 70 falsified the "clean window" hypothesis:** re-dispatched `abc` on `2b9f8a7` ~3 h after the last free-lane consumer (run 69 memory eval, 07:24Z) — all 3 suites still red, Suite A's anon 2nd `/v1/ask` 240 s-timed-out, **no product regression** (bootstrap recordings passed, no `schema_mismatch`). The free pools (NIM + OpenRouter `:free`) flap intrinsically on a minute timescale ⇒ contention timing was never the cause. **Now dark (rule 8):** only the founder-only independent 3rd free pool (its `blocked-by-human.md` bullet) lifts it | Sequencing rule (unchanged): never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.546, 07-11); agentic-frontier ≥ 0.80 (0.693, Δ 18.66 ✓); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (stranger N=0); destructive-op retry < baseline (instrumented run 38, N≈0); MCP in 3+ host apps (07-11: 0 stranger hosts, 1 founder host — FAIL); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **15** (fresh grep 07-16 run 86; unchanged since run 78, was 17). Run 78 reclassified 2 decided-deferral ICP bullets (`icp-mining`: Reddit disable [SK-ICP-011], 10th-source refactor pin [P5]) to the canonical "Parked until `<trigger>`" form their 4 siblings already use — honest miscount correction, not a genuinely-open question resolved | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever per the 07-11 /weekly (monoculture, no external yield); pullable only under a step-2 priority-3 waiver — run 86 declined the pull: the 15 bullets are genuine deferrals (see _Last change_) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (07-18 run-87 sweep: **121** pages, **2,970** internal + **14 cross-app** links). Layered coverage: built-output `href`/`src` sweep + cross-app subdomain verification (run 61) + prod sitemap-200 check (run 72) + `client-nav-integrity.test.ts` (SK-WEB-022) guarding both `location.*` JS navigations (run 77) **and** static `<a href="/literal">` source literals (run 87, after legal-page bare-path 307s) — dotted assets + dynamic `href={…}` skipped, negative-tested | target 0 — `bun run build && bun run check:links` (built-output) + `client-nav-integrity.test.ts` (in CI) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 open** (claim-vs-reality on shipped surfaces + docs; target 0 **met**). Runs 32 + 37 + 56 + 59 + 62 + 64 + 72–74 + 76 each found/closed 1 agent-movable gap (most recent: run 76 verified `brew install nlqdb/tap/nlq` live — tap `nlq.rb` sha256 matches the formula, tarball ships the binary). **Standing guards — all three advertised-capability surfaces now closed-world CI-swept**, each deriving its truth from source (never hand-copied) and naming the phantom + file on failure: `mcp-tool-integrity.test.ts` (MCP tools, run 64, `apps/web/src`), `cli-verb-integrity.test.ts` (CLI verbs from the cobra tree, run 74, web + docs prose), and **`sdk-method-integrity.test.ts` (SDK methods, run 88, `SK-SDK-013`)** — sweeps `apps/web/src` + `apps/docs/src` for `client.<method>(` / `NlqClient.<method>` against the shipped `NlqClient` type; 0 phantom live, negative-tested, false-positive-free. Next candidate: a docs-prose sweep of MCP-tool names (`mcp-tool-integrity` is `apps/web/src`-only) |
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

**2026-07-18 (run 88)** — **Product-readiness / claim-integrity lever (row #19):
SDK method surface guarded — the last un-guarded advertised capability.** CLI
verbs (run 74) and MCP tools (run 64) each had a standing CI guard, but the SDK
method surface (`client.*` / `NlqClient.*`) did not — a phantom `client.foo(...)`
copy-pasted from the site or docs throws on a stranger's first SDK call (the
run-62 `nlqdb_recall` failure mode in the SDK lane, `GLOBAL-003`) and slips CI
between manual sweeps. Built `apps/web/src/data/sdk-method-integrity.test.ts`
(`SK-SDK-013`): sweeps `apps/web/src` (`.ts/.tsx/.astro`) + docs-site
`apps/docs/src` (`.md/.mdx`) for `client.<method>(` snippets and
`NlqClient.<method>` references and fails CI on any member absent from the shipped
`NlqClient` type — **derived** from `packages/sdk/src/index.ts` (JSDoc-anchored,
brace-matched so nested `databases.connect` is caught and method params are not)
and **pinned** by a second test so an SDK rename/add/drop is caught too, never
hand-copied. **Number:** advertised-but-unshipped SDK methods **0 → 0, now
CI-enforced** (18 distinct refs swept, all shipped). Negative-tested (fails on an
injected `client.recall` in `sdk.mdx`, naming segment + file), false-positive-free
(Astro `client:` colon-directives + Go/Rust PascalCase idioms don't match).
Documented as `SK-SDK-013` (sdk feature; kept the block terse — full rationale in
the self-documenting test header, D5). **Why this lever:** row #19's explicitly
named "next candidate"; a different lever category from the web-UX rut (rule 7,
runs 80–85) and last run's surface-integrity (87); engine unmeasurable here
(`SK-QUAL-023`, egress-gated). **Step-1 refresh:** CI green `4afc71b`; typecheck +
lint + full test (926 api + 66 web-data) green; docs-ambiguity **15** (fresh
grep); users **9** / strangers **0** carried (07-16 pull, newest reg 07-06); GSC
28d **1 click / 455 impr / pos 16.4** carried (07-18); engine rows #8/#9 at the
7-day freshness boundary (re-dispatch due post-merge). **Artifact (step 3):** queue
**2** (< 3) → no forced publish; this run's lesson (advertised-vs-shipped drift
needs a derived-not-hand-copied guard) closely overlaps the queued
`guard-advertised-capabilities-against-code` draft → no new draft. **KPI
(GLOBAL-025):** **UX** + **onboarding** — a stranger's first SDK call can no longer
hit a phantom advertised method; no KPI degrades.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
