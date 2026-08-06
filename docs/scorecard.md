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

**Worst number today (run 170, 2026-08-06):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — **dark (rule 8, 9+ consecutive runs …165/166/167/168/170)** and **not
pullable**: criteria 1/2/3/5 gate on **D-04** (prod `NLQDB_MEMORY_DB` + the queue-#2 `NLQDB_API_KEY`
secret) and criterion **4** (ops-temporal 0/4) has **no GLOBAL-037-compliant agent-movable lever**
(E-09's two unblock paths are both non-daily: a preset-schema DDL-`ENUM` re-scope that touches the
`SK-PIVOT-007` free-text contract → needs its own scoping run, or a founder supersession — the doc says
"do not implement"). **This run pulled a lane-1 distribution lever (row #6: /solve 38 → 39 pages)** —
a new pain-page `calculate-time-between-two-dates-in-sql` (date-arithmetic: `end - start` interval +
`EXTRACT(EPOCH …)/86400` whole-day count), a distinct primitive from the window/aggregate/set-op cluster.
Not a rule-7 rut (last 5 merged dailies: 168 distribution · 167 docs · 166 null · 165 docs · 164 docs).
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — no agent-movable lever
this run (D-04 secret-blocked; criterion 4 GLOBAL-037-blocked).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 54 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit nlqdb to the Anthropic **connector
directory** (money-gated, since 07-21). Queue **depth 2** (#911 drained 6→2); head age 54 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (11 d) / **#9 Spider 0.2222** (**18 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4); dogfood gate criteria (D-04 secret-blocked, E-09 GLOBAL-037-blocked).

**Rule 6 — GREEN.** `main@e24b029` (#911 merged since run 168, docs-only so no deploy fired — expected).
Prior deploy state carried: all 8 deploy workflows + CI / Security / Release-npm / docs→memory-resync
last **success** on their HEAD SHAs through run 168. Verified full-green locally on this run's
branch (after a `bun install` restored container-lost `@cloudflare/workers-types`/`bun-types` — an
ephemeral-container artifact, not a code change): `bun run typecheck` (exit 0), `bun run lint` (exit 0,
warnings only), `solve.test.ts` 18/18, `@nlqdb/web test` 480/480, `@nlqdb/web build` (exit 0 — 129 pages,
new slug rendered + in sitemap 119 + `llms.txt`). This run's diff is **one code file**
(`apps/web/src/data/solve.ts`, +~72 lines — a new `/solve` entry + one inbound `related` link) plus
`docs/scorecard.md`. Open PRs (3): **#914** (reach R-10b `/agent-memory-benchmarks`), daily **#913**
(run 169 RLS blog publish), draft **#719** (oldest, **20 days**). This run's files overlap **no** open PR
(#913 touches `blog.ts`/`distribution-queue.md`; #914 touches `memoryBenchmarks.ts`/sitemap `STATIC_ROUTES`/
`llms.txt`/Footer — my `/solve` slug auto-aggregates via the solve loop, not those hand-edited lists;
#719 is docs-research). Scorecard regen is step-0-exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-06** (`rum-pull.ts`, 7d 07-30→08-06); GSC carried from run 167. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **194 pl / 190 vis** raw, **real-browser floor 52 pl / 50 vis** (07-30→08-06, re-pulled 08-06; 142 synthetic cut). Real-browser landings led by `nlqdb.com/` (**12**), `docs…/agent-memory/` (7), `/blog/guard-advertised…/` (6), `/app/new/` + `/agents/` (3 each) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **107** content pages (`/solve` **39** + `/vs` 31 + `/blog` 37); **119** sitemap URLs — **this run +1** (`/solve/calculate-time-between-two-dates-in-sql`, the date-arithmetic "time between two dates" pain-page; build-verified rendered + auto-picked up by sitemap + `llms.txt`). Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC **carried from run 167** (`gsc-pull.ts`): 28d 07-06→08-03 **8 clicks / 587 impr / pos 19.7** — flat. **Referral yield (RUM, re-pulled live 08-06):** 13 pl from 3 referrers — bing 6, google 5, baidu 2; bing refers `/blog/guard-advertised…` (4) + `docs…/agent-memory/` (1), baidu `/blog/agent-memory-vector-store…` (2). Strengthen-next #1 `/solve/running-total-cumulative-sum-in-sql/` (121 impr / pos 36.3), #2 `find-rows-with-no-match` (44 / 17.5) — both runs 163/159's targets (anti-rut, verify at R-08 08-22, not re-pulled). Index status: **3/6 wedge pages indexed**; `build-vs-buy`/`expire-old` discovered-not-crawled (crawl-timing, well-linked from indexed `/agents/`) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
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
| | **Human queue** — the one non-automatable actor | **depth 2** (#911 drained 6→2); head is the Show HN launch, oldest bullet **54 days** (`SK-PIVOT-016` gate **0/5**); #2 Anthropic connector directory (money-gated, 07-21) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 3 — **#914** (reach R-10b) + daily **#913** (run 169) + draft **#719** (oldest, 20 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (170):** shipped a new `/solve` pain-page (row #6 +1), not a `/blog` post. Queue depth 2
  (< 3), so step 3's forced-publish did not fire; dev.to drip self-throttled (one/day, `SK-BLOG-003`).
  Last canonical blog post remains run 151's `/blog/guard-advertised-capabilities-against-code/`.
  New AEO surface: `nlqdb.com/solve/calculate-time-between-two-dates-in-sql`.

## Last change

**2026-08-06 (run 170)** — **Row #6 indexable surfaces 106 → 107** (`/solve` 38 → 39): shipped a new
pain-driven AEO page, `/solve/calculate-time-between-two-dates-in-sql`, answering the recurring
"time / difference between two dates in SQL" search. It's a genuinely-distinct primitive from the
existing cluster — scalar/aggregate date arithmetic (subtracting two `date`s → integer days, two
`timestamp`s → an `interval`), not a window function (running-total/MoM/top-N), an ordered-set aggregate
(median), a set difference (anti-join), or a reshape (pivot). The page names the two real traps:
`age(end, start)` month-normalizes the gap (a 40-day span → '1 mon 9 days', so `EXTRACT(DAY FROM age(…))` reads 9, not 40) whereas plain `end - start` stays in days,
so the whole-day count is `EXTRACT(EPOCH FROM (end - start)) / 86400`; and averaging durations means
`AVG(end - start)` over intervals. Full SK-SOLVE-001/002/003 shape: paraphrased search-intent `<h1>`,
4 `howNlqdbAnswers` (each ≤25 w), 3 honest limits (you name the two timestamps; tz-as-stored; read-only
embed), 4 FAQs (each ≤80 w), 3 enduring source hubs (PG date/time-functions docs + the SO `datediff`
and `date-arithmetic` tags). To avoid a crawl-orphan, it links out to 3 same-cluster date/time siblings
(count-per-day, MoM, streak) **and** receives an inbound `related` link from the page-1 date sibling
`count-rows-per-day-including-missing-dates`. `solve.test.ts` 18/18, `@nlqdb/web test` 480/480,
typecheck/lint exit 0, build exit 0 (129 pages). Sitemap + `llms.txt` auto-aggregate the slug (118 → 119).

**Why lane-1 distribution.** Weekly focus (dogfood gate 0/5) is dark (rule 8, 9+ runs): criteria 1/2/3/5
gate on D-04 (prod secret); criterion 4 (ops-temporal 0/4) is E-09, **P1-blocked by `GLOBAL-037`**. Lane 2
(UX/engine) isn't pullable in-container: walkers can't run (row #21: Chromium 1194 vs pinned 1223), engine
#8/#9 dark. So the smallest agent-movable lever is a lane-1 AEO surface that needs no strangers, walker, or
secret. Not a rule-7 rut — last 5 merged dailies were 168 distribution · 167/165/164 docs · 166 null. Two
distribution PRs (#913 blog, #914 benchmark asset) are already open; this touches only `solve.ts`, no overlap.

**Four-null check.** `git log`: run 167 moved row #17 and this run is non-null (row #6 delta) — no
four-null streak, so no surface-area proposal is earned.

**Step 3 (artifact):** the run's lever IS a published distribution surface (the `/solve` page), so no
separate `/blog` draft — queue depth 2 (< 3) so forced-publish did not fire; dev.to drip self-throttled
(one/day). **KPI (GLOBAL-025):** the new AEO page advances **onboarding** (a search-intent on-ramp whose
CTA points at anonymous `/app/new`) and **distribution** (+1 indexable surface, leading input to funnel
rows #1–#3); **degrades none** (docs/data only, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
