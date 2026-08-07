# Scorecard — current state

Point-in-time tracker, regenerated each [`/daily`](../.claude/commands/daily.md)
run. Current state only — no changelog (≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md`.

**Weekly focus number (2026-07-28 →, founder-set, advisor session):**
**The [`SK-PIVOT-016`](features/agent-memory-pivot/decisions/SK-PIVOT-016-dogfood-launch-gate.md)
dogfood gate — criteria green: 0/5 → 5/5.**
Founder directive 2026-07-28 (advisor session): the operating focus is the **dogfood
gate** — nlqdb's own agents running a real memory workload through the public MCP
surface. Execution track:
[`agent-memory-pivot/worksheets/dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md)
(`D-01..D-07`), which carries the per-criterion owner. Every criterion is agent-movable;
only the founder may loosen one, and the gate is condition-gated — never dated.
**Prior focus (superseded 2026-07-28):** acquisition — channels live with attributable
yield → ≥ 5 (row #22, now 4), [`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md).
Acquisition levers stay pullable when no dogfood lever is — as does premium-chain work
(`SK-LLM-017`, row #20), one rank below.

**Worst number today (run 172, 2026-08-07):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — **dark (rule 8, 11+ consecutive runs …165/166/167/168/170/171/172)** and **not
pullable**: criteria 1/2/3/5 gate on **D-04** (prod `NLQDB_MEMORY_DB` + the queue-#2 `NLQDB_API_KEY`
secret) and criterion **4** (ops-temporal 0/4) has **no GLOBAL-037-compliant agent-movable lever**
(E-09's two unblock paths are both non-daily: a preset-schema DDL-`ENUM` re-scope that touches the
`SK-PIVOT-007` free-text contract → needs its own scoping run, or a founder supersession — the doc says
"do not implement"). **This run pulled a lane-1 distribution lever (row #6: /solve 39 → 40, 110 total)** —
shipped `/solve/countif-sumif-conditional-aggregate-in-sql` (rationale + evidence in "Last change"). Rule-7
permitted (last 5 dailies 171/170/169/168 dist · **167 docs** — not 5-identical); **this is the last
permitted distribution pull — next run must diversify or measure yield.**
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — no agent-movable lever
this run (D-04 secret-blocked; criterion 4 GLOBAL-037-blocked).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 55 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit nlqdb to the Anthropic **connector
directory** (money-gated, since 07-21). Queue **depth 2**, head age 55 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (12 d) / **#9 Spider 0.2222** (**19 d**
stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows **#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation, remedy costs money ⇒
rule 4); dogfood gate criteria (D-04 secret-blocked, E-09 GLOBAL-037-blocked).

**Rule 6 — GREEN.** Branch based on `main@1f12249` (run 171 #916). Deploy state verified live this run:
**Deploy API** + **CI** both last **success** on the current main HEAD SHA `1f122495b`
([Deploy API](https://github.com/nlqdb/nlqdb/actions) 2026-08-07, CI 2026-08-07); the cancelled CI on
`c31c8c6` is a superseded push, normal. Verified full-green locally on this run's branch (after a
`bun install` restored container-lost workers/bun types — an ephemeral-container artifact, not a code
change): `bun run typecheck` (exit 0), `bun run lint` (exit 0, 41 warnings), `@nlqdb/web test` **488/488**
(the `SOLVE_ENTRIES` data-integrity suite iterates the new entry — all AEO invariants green),
`@nlqdb/web build` (exit 0 — **133 pages**, new page rendered + in sitemap + `llms.txt`), `check-links.mjs`
(**3844 internal + 20 cross-app, 0 dead / 0 redirecting**). Diff is **one code file** (`apps/web/src/data/solve.ts`,
+~60 lines — one `SolveEntry` + one inbound `related` link on `pivot-rows-into-columns`) plus
`docs/research/distribution-queue.md` (run-14 dev.to venue → live URL) + `docs/scorecard.md`. Open PRs (**1**): only draft **#719** (Infisical secrets research, oldest, **21 days**).
This run's files overlap **no** open PR (#719 is docs-research); scorecard regen is step-0-exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-06** (`rum-pull.ts`, 7d 07-30→08-06); GSC carried from run 167. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **194 pl / 190 vis** raw, **real-browser floor 52 pl / 50 vis** (07-30→08-06, re-pulled 08-06; 142 synthetic cut). Real-browser landings led by `nlqdb.com/` (**12**), `docs…/agent-memory/` (7), `/blog/guard-advertised…/` (6), `/app/new/` + `/agents/` (3 each) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **110** content pages (`/solve` **40** + `/vs` 31 + `/blog` 39); **123** sitemap URLs — **this run +1** (`/solve/countif-sumif-conditional-aggregate-in-sql`, the `COUNTIF`/`SUMIF`→SQL conditional-aggregation query; build-verified rendered + auto-aggregated into sitemap + `llms.txt` + `/solve` index). Unpublished blog drafts **0** (queue drained run 171) — this run's lever is a new `/solve` page, not a blog draw | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **39** (unchanged — this run's surface is a `/solve` page, not a `/blog` post). **dev.to +1 this run** (`SK-BLOG-003` autonomous drip, not throttled): posted the run-14 variant `bird-gold-noise-distinct` → [live](https://dev.to/omer_hochman/your-text-to-sql-model-isnt-as-wrong-as-your-benchmark-says-the-gold-sql-is-p16). GSC **carried from run 167** (`gsc-pull.ts`): 28d 07-06→08-03 **8 clicks / 587 impr / pos 19.7** — flat. **Referral yield (RUM, carried 08-06):** 13 pl from 3 referrers — bing 6, google 5, baidu 2. Strengthen-next #1 `/solve/running-total-cumulative-sum-in-sql/` (121 impr / pos 36.3), #2 `find-rows-with-no-match` (44 / 17.5) — runs 163/159's targets (anti-rut, verify at R-08 08-22, not re-pulled). Index status: **3/6 wedge pages indexed** | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **11 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left behind, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers** (⇒ events queue ~0 ops/day, well under the 7K ceiling) |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. Read p95: account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — pure time-decay, no suite changed state). Per suite `pass × freshness`: **mcp** (✅ 07-25) · **sdk** (✅ 07-24) · **examples** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ freshness floored — documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (**7 → ≈12** — regressed, not this run's lever). #909 (merged since run 167) added `expert-knowledge-platform/FEATURE.md` with **5 forward-research bullets** (fee %, cross-tenant grant, interview-extraction, regulated-professions, launch-motion) — genuinely-deferred for a not-yet-built platform, so GLOBAL-033 "Parked until `<trigger>`" conversion is the fix a **future** meta-run makes; not pulled here (this run is lane-1, breaking the docs rut of runs 164/165/167) | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`, judged for genuine openness. Lane-3 meta — reported not pulled |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166 live on `main` (`astro build` → `check:links`): **127 pages, 3,535 internal + 20 cross-app links**, all resolve. This run's diff is docs-only (no built surface changed), so #18 carries at target 0 | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.` host un-redirected (zone Redirect Rule ⇒ console click), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints. `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) concluded success. **Not re-walkable from a `/daily` container** (standing constraint re-verified this run): `@playwright/test` pins `~1.60.0` → wants Chromium **1223**; the image ships **1194** (`/opt/pw-browsers/chromium-1194`), so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. **npm attribution now reaches the registry for all 3 of 3 packages** (verified live this run): `@nlqdb/sdk@0.2.2` (`?utm_source=npm`), `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`), and the former laggard **`@nlqdb/cli@0.1.1` — `?utm_source=npm` now live on the registry** (`dist-tags.latest = 0.1.1`, published via #864 + the green Release-npm run). Last-third close ⇒ npm attribution 2/3 → 3/3. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 2**; head is the Show HN launch, oldest bullet **55 days** (`SK-PIVOT-016` gate **0/5**); #2 Anthropic connector directory (money-gated, 07-21) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **1** — draft **#719** (oldest, 21 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**40 canonical `/solve` pages** + **39 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`
— the one place each list exists; venue variants stay in `research/distribution-queue.md`.

- **This run (172):** shipped a new `/solve` page (row #6 +1): `nlqdb.com/solve/countif-sumif-conditional-aggregate-in-sql`
  — the `COUNTIF`/`SUMIF`→SQL conditional-aggregation query. **dev.to +1** (autonomous drip, not throttled):
  posted the run-14 variant `bird-gold-noise-distinct` → https://dev.to/omer_hochman/your-text-to-sql-model-isnt-as-wrong-as-your-benchmark-says-the-gold-sql-is-p16
  (queue line updated: dev.to venue dropped, live URL appended; r/LLMDevs + lobste.rs stay human). Blog draft
  queue is empty (drained run 171), so no forced-publish; step-3.2 drafting skipped (optional, P5).

## Last change

**2026-08-07 (run 172)** — **Row #6 indexable surfaces 109 → 110 / `/solve` 39 → 40**: shipped a new
`/solve` page, `/solve/countif-sumif-conditional-aggregate-in-sql` — the spreadsheet `COUNTIF`/`SUMIF`→SQL
translation (a P3-analyst query re-Googled every reporting cycle). Content: the `COUNT(*) FILTER (WHERE ...)`
modern form, the silent `COUNT(status='paid')` over-count trap (`COUNT` counts non-null values, not truths),
`FILTER` vs the portable `SUM(CASE WHEN ...)` fallback, and multi-metric one-pass counts. Genuinely distinct
search-intent from the 39 existing pages — `pivot-rows-into-columns` uses `FILTER` for the wide *crosstab*
intent; this is the single-conditional-metric intent (the highest-volume spreadsheet-user query). Gets one
inbound `related` link from indexed sibling `pivot-rows-into-columns` (crawl-priority remedy vs "Discovered -
not indexed") and links out to 3 same-cluster aggregation siblings. `@nlqdb/web test` **488/488** (the
`SOLVE_ENTRIES` data-integrity suite iterates the new entry — all AEO invariants green), typecheck/lint exit 0,
build exit 0 (**133 pages**, page + sitemap + `llms.txt`), `check-links` **3844 internal / 20 cross-app, 0 dead
/ 0 redirecting**. Also drained the autonomous dev.to drip (`SK-BLOG-003`, not throttled): run-14 variant now
[live](https://dev.to/omer_hochman/your-text-to-sql-model-isnt-as-wrong-as-your-benchmark-says-the-gold-sql-is-p16).

**Why lane-1 distribution (not lane-2/3).** Weekly focus (dogfood gate 0/5) is dark (rule 8, 11+ runs):
criteria 1/2/3/5 gate on D-04 (prod secret); criterion 4 (ops-temporal 0/4) is E-09, **P1-blocked by
`GLOBAL-037`**. Lane 2 (UX/engine): walkers can't run in-container (row #21: Chromium 1194 vs pinned 1223),
engine #8/#9 dark, and the stranger-facing error surfaces (`error-message.ts`, `create-errors.ts`) are
already polished + fully unit-tested — there is **no genuine UX defect to fix**, and manufacturing one
violates rule 2. Lane 3 (docs-ambiguity #17) is rutted (runs 164/165/167) and its regression is `/ek`-owned
(the EKP feature's 5 forward-research bullets). So the smallest honest agent-movable lever is a lane-1 `/solve`
surface that needs no strangers, walker, or secret and moves row #6 (a leading funnel input). Rule-7 permitted
(last 5 merged dailies: 171/170/169/168 distribution · **167 docs** — not 5-identical); **this is the last
permitted distribution pull — next run must diversify or measure distribution yield.** Only open PR is
docs-research #719 — no overlap.

**Four-null check.** Recent runs 171/170/169/168 all shipped deltas — no four-null streak, no proposal earned.

**Step 3 (artifact):** the run's lever IS the new `/solve` page. Blog draft queue empty (drained run 171) ⇒
no forced-publish; step-3.2 drafting skipped (optional, P5); dev.to drip drained one variant (above).
**KPI (GLOBAL-025):** advances **distribution** (+1 indexable surface + 1 dev.to venue, leading input to
funnel rows #1–#3); **degrades none** (data/docs only, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
