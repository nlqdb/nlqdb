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

**Worst number today (run 168, 2026-08-05):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — **dark (rule 8, 7+ consecutive runs 156/158/163/164/165/166/167)** and **not
pullable**: criteria 1/2/3/5 gate on **D-04** (prod `NLQDB_MEMORY_DB` + the queue-#2 `NLQDB_API_KEY`
secret) and criterion **4** (ops-temporal 0/4) has **no GLOBAL-037-compliant agent-movable lever**
(E-09's two unblock paths are both non-daily: a preset-schema DDL-`ENUM` re-scope that touches the
`SK-PIVOT-007` free-text contract → needs its own scoping run, or a founder supersession — the doc says
"do not implement"). **This run is a NULL RUN — no lane cleared the step-2 bar.** The one same-day
meta-lever (row #17 docs-ambiguity) is owned by **open PR #907** (run 167, unmerged) → step-0 forbids
duplicating it; every other lane is blocked/saturated/dark (see Last change).
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — no agent-movable lever
this run (D-04 secret-blocked; criterion 4 GLOBAL-037-blocked).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 53 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit the `nlqdb-memory` plugin to Anthropic's
community plugin directory (⏱ ~5 min). Queue **depth 6**; head age 53 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (10 d) / **#9 Spider 0.2222** (**17 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4); dogfood gate criteria (D-04 secret-blocked, E-09 GLOBAL-037-blocked).

**Rule 6 — GREEN (independently re-verified this run).** `main@db3e903` — this run ran the full gate in
a fresh container: `bun run typecheck` ✅, `bun run lint` ✅, `bun run test` ✅ (**1014 passed / 15
skipped**, 81 files). CI **success** on the latest main SHA; all deploy workflows were **success** on
`db3e903` (2026-08-05 00:19Z) and `main` has not moved since, so they still hold. The only
`action_required` runs (Security / CI / Preview) are on the **changesets** branch `78485701` (#906), not
main. This run's diff is **docs-only** (`docs/scorecard.md`) — no code touched. Open PRs (5): **#909**
(founder vision docs), **#908** (reach R-10a), **#907** (daily 167 — docs-ambiguity, owns row #17 +
`events-pipeline/FEATURE.md`), **#906** (changesets), draft **#719** (oldest, **19 days**). This run's
file (`docs/scorecard.md`) overlaps **only** #907, which also regenerates the scorecard — **scorecard
regen is step-0-exempt**; every other lever/file is left to its open PR.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (GSC + RUM both pulled live by run 167 **~8 h ago, same day** — carried, not re-pulled this null run: same-day re-pull is crawl/traffic noise; Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **198 pl / 195 vis** raw, **real-browser floor 60 pl / 59 vis** (07-29→08-05, live pull run 167, up from run 159's 40/39; 138 synthetic cut). Real-browser landings led by `docs…/agent-memory/` (**11**), `nlqdb.com/` (9), `/blog/guard-advertised…/` (7), `/agents/` (3) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs. Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC live-pulled by run 167 (`gsc-pull.ts`, ~8 h ago), carried: 28d 07-06→08-03 **8 clicks / 587 impr / pos 19.7** — **19th consecutive roughly-flat read** (was 8/597/19.4), `/security/hall-of-fame/` 4 of 8 clicks. **Referral yield (RUM):** 14 pl from 3 referrers — bing 6, google 6, baidu 2; bing already refers `docs…/agent-memory/`. Strengthen-next #1 `/solve/running-total-cumulative-sum-in-sql/` (121 impr / pos 36.3), #2 `find-rows-with-no-match` (44 / 17.5) — both **exactly** runs 163/159's targets (anti-rut, verify at R-08 08-22, not re-pulled). Index status: **3/6 wedge pages indexed**; `build-vs-buy`/`expire-old` discovered-not-crawled (crawl-timing, well-linked from indexed `/agents/`), `docs…/agent-memory/` unknown-to-Google but **live, in sitemap, linked from `/agents/`** ⇒ timing-bound, not fixable | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **10 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **8 on main → 7 pending open PR #907** (run 167's lever; elements 2, + 6 features 1 each). Re-counted live this run across all `FEATURE.md` files: **8** genuinely-open bullets on `main` (the events-pipeline queue-free-tier-ceiling bullet #907 marks `Decided:` is still unmarked on main). **Not pulled this run** — #907 owns it (step-0). Remaining after #907: agent-memory WS-11 (infra), cli Windows (hardware), e2e Suite-A (llm-router, N-run window), elements ×2 (cross-cutting api-keys), gtm-metrics (D-04-owned), quality-eval (baseline-gated) | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. Lane-3 meta-lever, de-prioritised (07-11 /weekly) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166 live on `main` (`astro build` → `check:links`): **127 pages, 3,535 internal + 20 cross-app links**, all resolve. This run's diff is docs-only (no built surface changed), so #18 carries at target 0 | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.` host un-redirected (zone Redirect Rule ⇒ console click), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints. `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) concluded success. **Not re-walkable from a `/daily` container** (standing constraint): `@playwright/test` pins `~1.60.0` → wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. **npm attribution now reaches the registry for all 3 of 3 packages** (verified live run 167): `@nlqdb/sdk@0.2.2` (`?utm_source=npm`), `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`), and the former laggard **`@nlqdb/cli@0.1.1` — `?utm_source=npm` now live on the registry** (`dist-tags.latest = 0.1.1`, published via #864 + the green Release-npm run). Last-third close ⇒ npm attribution 2/3 → 3/3. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 6**; head is the Show HN launch, oldest bullet **53 days** (`SK-PIVOT-016` gate **0/5**); #2 community-plugin-directory submit, #3 `cline/mcp-marketplace` issue, #4 connector directory (money-gated), #5 🔒 goal-pack build-order lock, #6 skillsclaude.org paste | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 5 (#906–#909 + draft #719), oldest 19 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (168):** null run — no lever cleared the step-2 bar, so step 3 (artifact) is skipped
  entirely per the loop. Queue depth 2 (< 3); dev.to drip self-throttles to one/day (`SK-BLOG-003`),
  a no-op on a null run. Last canonical blog post remains run 151's
  `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-08-05 (run 168)** — **NULL RUN. No scorecard number moved** — no lane cleared the step-2 bar, so
per the loop this run ships only the step-1 scorecard regeneration and records the finding. The recorded
finding (in place of a delta): **run 167 (~8 h ago) already pulled the only same-day-movable lever
(row #17 docs-ambiguity) and re-pulled every live measurement (GSC 19th flat, RUM 60/59); 8 hours later
there is nothing fresh a single run can move without either duplicating open PR #907 (step-0) or
manufacturing busywork.**

**Why null (dropped through every step-2 lane).**
- **Weekly focus — dogfood gate 0/5 (dark, rule 8, 7+ runs).** Criteria 1/2/3/5 gate on D-04 (prod
  secret); criterion 4 (ops-temporal 0/4) is E-09, **P1-blocked by `GLOBAL-037`** ("do not implement").
  Not agent-movable.
- **Lane 1 — acquisition: saturated same-day.** GSC/RUM were live-pulled by run 167 this same day
  (8 clicks / 587 impr / pos 19.7, **19th flat read**; RUM 60/59, 14 referral pl). A re-pull 8 h later is
  crawl/traffic noise; the two top off-page-1 targets are exactly runs 163/159's (anti-rut, verify at
  R-08 08-22). npm attribution already closed 2/3 → 3/3 at run 167. Reach owns the R-slices and has an
  open PR (#908) — step-0 keeps me off it.
- **Lane 2 — UX-flow / engine.** Walkers not runnable in-container (row #21: Chromium 1194 vs pinned
  1223, re-verified). Engine #8/#9 dark (async resume, `main` moved); memory-temporal = E-09 block.
- **Lane 3 — docs-ambiguity (the one meta-lever left):** owned by **open PR #907** (row #17) → step-0
  forbids duplicating it. No other agent-movable meta-lever this run.

**This run's genuine fresh facts (measurements, not deltas).** Independently ran the full gate in a fresh
container: **typecheck ✅ · lint ✅ · test ✅ (1014 passed / 15 skipped)** — main is not red (rule 6
GREEN), a first-hand confirmation, not a carry. Refreshed the open-PR roster to 5 (#906–#909 + draft
#719) and rule-6 to `main@db3e903` (unchanged since run 167; deploys still green). Row #17 re-counted
live: **8 on main** (#907 resolves to 7). Row #18 carries at target 0 — main code unchanged since run
166's sweep, so the built surfaces are byte-identical.

**Four-null check.** `git log`: runs 163/164/165 moved real numbers, 166 was null, 167 moved row #17 —
this is **not a four-null streak** (166 → 168 is at most the 2nd null with a real run between), so no
surface-area proposal is earned; back to null runs until a lane unblocks.

**Step 3 (artifact):** skipped — a null run ships only the step-1 scorecard update (dev.to drip +
drafting are step 3, no-op on a null run). Queue depth 2 (< 3). **No new `SK-*`** (P5/D5). **KPI
(GLOBAL-025):** the fresh main-green + open-PR re-verification is evidence the four pillars are
regression-free this cycle; **degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
