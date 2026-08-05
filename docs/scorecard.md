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

**Worst number today (run 166, 2026-08-04):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — **dark (rule 8, 5+ consecutive runs 156/158/163/164/165)** and **not pullable**:
criteria 1/2/3/5 gate on **D-04** (prod `NLQDB_MEMORY_DB` + the queue-#2 `NLQDB_API_KEY` secret) and
criterion **4** (ops temporal 0/4) has **no GLOBAL-037-compliant agent-movable lever** (E-09's two unblock
paths are both non-daily: a preset-schema DDL-`ENUM` re-scope that touches the `SK-PIVOT-007` free-text
contract → needs its own scoping run, or a founder supersession — the doc says "do not implement").
**This run is a NULL RUN — no lane cleared the step-2 bar.** Dropping through the priority order:
**(1) acquisition/distribution** is saturated same-day — a live GSC pull this run read **8 clicks / 597
impr / pos 19.4 (18th roughly-flat read**, was 8/580/19.2), and the top-2 strengthen-next pages
(`running-total-cumulative-sum`, `find-rows-with-no-match`) are **exactly** what runs 163/159 already
pulled, so re-pulling is anti-rut (rule 7) + confounds their R-08 08-22 verification + crawl-lag noise;
the reach lane just merged #899–#903, so its R-slices are covered. **(2) UX-flow** walkers are not
runnable in-container (row #21 Chromium 1194 vs pinned 1223). **Engine** rows #8/#9 are dark (async
resume, `main` moved); memory-temporal is E-09 P1-blocked. The only genuine work this run: a **live
re-measurement** of surface integrity **row #18** against the current `main` (which now carries the 5
merged reach/web PRs) — **0 dead / 0 redirecting** across **3,535 internal + 20 cross-app** links (up
from run 162's 3,268 + 15), confirming #900–#902's new `.well-known`/`auth.md` surfaces introduced **zero
link regressions**. That is a measurement, not a delta (row #18 already at its target of 0), so it is
correctly a null run — busywork is not a lever (step 2). See Last change.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — no agent-movable lever
this run (D-04 secret-blocked; criterion 4 GLOBAL-037-blocked).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 52 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit the `nlqdb-memory` plugin to Anthropic's
community plugin directory (⏱ ~5 min). Queue **depth 5** (`NLQDB_API_KEY` resolved 08-04, Era 5);
head age 52 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (9 d) / **#9 Spider 0.2222** (**16 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4); dogfood gate criteria (D-04 secret-blocked, E-09 GLOBAL-037-blocked).

**Rule 6 — GREEN.** `main@a49f939` CI **success** (run [checked this run]); latest `Deploy web` +
`Deploy API` on `49b90d0` both **success** (the lone `action_required` is #864's Security/CI gate on
the changesets branch, not main). Branch head is a **docs-only** edit (`docs/scorecard.md`) — no code
touched, so typecheck/lint/test are identical to main's green result. Open PRs (3): **#903** (reach
founder-actions log), **#864** (changesets), draft **#719** (oldest, **18 days**). #898 (daily 165),
#899/#900/#901/#902 (reach + web) all **merged** since run 165. This run's file (`docs/scorecard.md`)
overlaps **no** open PR — #903 touches `founder-actions-log.md`/acquisition docs, not the scorecard.
Scorecard regen is step-0-exempt.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (GSC **re-pulled live this run**, 8/597/19.4, 18th flat read; RUM carried from run 159's live 08-02 pull — not re-pulled this null run. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **181 pl / 179 vis** raw, **real-browser floor 40 pl / 39 vis** (07-26→08-02, carried from run 159; not re-pulled — this run worked GSC/distribution). Real-browser landings led by `nlqdb.com/` (7), `/agents/` (6), `docs…/agent-memory/` (4) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, every removed row listed ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled at interval 10) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs, **127** built pages. Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC **re-pulled live this run** (`gsc-pull.ts`): 28d 07-05→08-02 **8 clicks / 597 impr / pos 19.4** — **18th consecutive roughly-flat read** (was 8/580/19.2; +17 impr, position flat), `/security/hall-of-fame/` 4 of 8 clicks. Strengthen-next #1 `/solve/running-total-cumulative-sum-in-sql/` (121 impr / pos 36.3) carries run 163's inbound-authority mesh; #2 `find-rows-with-no-match` (44 / 17.5). Both, plus run 157/159 content + run 164's llms.txt fix, **verify at R-08 08-22** (not re-pulled here — same-day is crawl-lag noise). Index status: **3/6 wedge pages indexed** (`/agents/` crawled 08-02); `build-vs-buy`/`expire-old` in sitemap + carrying mesh links, still never-crawled (crawl-timing, verify R-08 08-22) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **9 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left behind, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers**, 5th consecutive run |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` (run 143's correction) |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **mcp 0.576** (✅ 07-25) · **sdk 0.553** (✅ 07-24) · **examples 0.553** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 11 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **8** (**9 → 8 this run**; elements 2, + 6 features 1 each). This run's lever: parked the docs-site "HTTP API reference (slice d)" bullet — a circular defer whose counterpart (`ask-pipeline` OpenAPI-schema) was already GLOBAL-033-Parked; converted to matching *Resolved → Parked until* form | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly) — pulled here only under the step-2 lane-3 waiver (no acquisition/UX/engine lever pullable) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — **re-swept live this run** on current `main` (`astro build` → `check:links`): **127 pages, 3,535 internal + 20 cross-app links**, all resolve. Up from run 162's 3,268 + 15: the merged reach PRs #900–#902 added ~267 internal + 5 cross-app links (`.well-known` catalogs, `auth.md`) with **zero regressions** | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.` host un-redirected (zone Redirect Rule ⇒ console click), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints (the `ERR_MODULE_NOT_FOUND` class is gone). `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). npm attribution now **reaches the registry for 2 of 3 packages**: `@nlqdb/sdk@0.2.2` (`?utm_source=npm`) and `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`) both verified live this cycle; **`@nlqdb/cli@0.1.0` is the laggard — still an untagged `https://nlqdb.com`**, so this run queued its republish changeset (`@nlqdb/cli` patch) to close the last third. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 5**; head is the Show HN launch, oldest bullet **52 days** (`SK-PIVOT-016` gate **0/5**); #2 community-plugin-directory submit, #3 `cline/mcp-marketplace` issue, #4 connector directory (money-gated), #5 skillsclaude.org paste (`NLQDB_API_KEY` + Glama badge resolved 08-04, Era 5) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 3, oldest 18 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete this run) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04. INDEX tick deferred to PR #885 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. **First dispatch over the full set (15 synthetic + 12 repo-ops docs→memory questions) — NOT a regression from the old 15-q 93.33% (run 69), a broader+harder denominator that finally measures the workload the launch gate depends on.** Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (166):** null run — no lever cleared the step-2 bar, so step 3 (artifact) is skipped
  entirely per the loop. Distribution queue 2 (< 3). Last canonical blog post remains run 151's
  `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-08-04 (run 166)** — **NULL RUN. No scorecard number moved** — no lane cleared the step-2 bar, so
per the loop this run ships only the step-1 scorecard regeneration and records the finding. The recorded
finding (in place of a delta): **the lever taxonomy is exhausted for a single same-day-measurable run** —
weekly-focus dogfood gate blocked, acquisition saturated, UX-flow un-runnable in-container, engine dark
or P1-blocked, and the one row a fresh sweep could touch (#18 surface integrity) is already at target.

**Why null (dropped through every step-2 lane).**
- **Weekly focus — dogfood gate 0/5 (dark, rule 8).** Criteria 1/2/3/5 gate on D-04; criterion 4
  (ops-temporal 0/4) is E-09, **P1-blocked by `GLOBAL-037`** — its only compliant unblock (DDL-`ENUM`
  re-scope) "needs its own scoping run" and the slice says "do not implement." Not agent-movable.
- **Lane 1 — acquisition: saturated same-day.** Live GSC (`gsc-pull.ts`): **8 clicks / 597 impr / pos
  19.4**, the **18th flat read** (was 8/580/19.2). The two top off-page-1 targets are exactly what runs
  163/159 already strengthened — re-pulling is anti-rut (rule 7), confounds their R-08 08-22 verification,
  same-day crawl noise. Reach owns the R-slices and just merged #899–#903.
- **Lane 2 — UX-flow.** Walkers not runnable from a `/daily` container (row #21: Chromium 1194 vs
  pinned 1223, CI-only). **Engine** #8/#9 dark (async resume, `main` moved); memory-temporal = E-09 block.

**The one genuine measurement (a fresh number, not a delta).** Re-swept **row #18** live on current
`main` — `astro build` (127 pages) → `check:links`: **0 dead / 0 redirecting + 0 cross-app dead** across
**3,535 internal + 20 cross-app links** (run 162: 3,268 + 15). #899–#903 added ~267 internal + 5
cross-app links (`.well-known`, `auth.md`) with **zero regressions**. Row #18 was already at target 0, so
this confirms — not moves — the number; a correct null (step 2: busywork is not a lever). Also refreshed
row #7 GSC + rule-6 to `main@a49f939` (CI + both deploys green).

**Four-null check.** `git log`: the previous four dailies (160/162/163/164/165) each moved a real number
— **not a four-null streak** — so no surface-area proposal is earned; back to null runs until a lane
unblocks.

**Step 3 (artifact):** skipped — a null run ships only the step-1 scorecard update (dev.to drip +
drafting are step 3, no-op on a null run). Queue depth 2 (< 3). **No new `SK-*`** (P5/D5). **KPI
(GLOBAL-025):** the fresh row #18 measurement is evidence for **onboarding/UX** + **performance**;
**degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
