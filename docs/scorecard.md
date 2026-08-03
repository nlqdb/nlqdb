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

**Worst number today (run 161, 2026-08-03):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
— but **this run could not move it: the whole gate is triply blocked right now.** Criterion 1's
near-term path (D-02b → D-04) needs the founder-only **`NLQDB_API_KEY`** secret (queue #2, blocked
since 08-01) *and* the dogfood **`INDEX.md`** is being rewritten by open **PR #885** (step-0 overlap
— can't touch it); criterion 4 (temporal, ops 0/4) is **P1-blocked** by
[`GLOBAL-037`](decisions/GLOBAL-037-schema-only-llm-egress.md) via E-09; criteria 2/3/5 all
funnel through the same secret-gated D-04. **This run is a null run** — every fallback lane is
also blocked (see Last change). Distribution (row #7: **8 clicks / 562 impr / pos 19.3**, GSC 28d,
fresh this run) stays the acquisition-lane worst number, but its top strengthen-next pages are
comprehensive-or-just-reranking and breadth was just shipped by **#888**, so not a clean lever either.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5** — D-02b (convergent sync +
workflow) blocks on the `NLQDB_API_KEY` secret (queue #2) + a read-verb decision + the #885 INDEX overlap.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 51 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate. Queue **depth 6**; head age 51 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider 0.2222** (**15 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** `main@c94bb7a8` (run 160's merge): **CI success**, **Security success**, and
**all 9 Deploy workflows success** (API, Canary, docs, web, MCP, elements, coming-soon,
events-worker, Release npm) — production serves a current build. (The `action_required` CI/Preview
rows are on the changesets bot branch `544a0717`, awaiting bot-PR approval — not a main failure.)
This run's branch head touches only `docs/scorecard.md` (a null run) — no code, `typecheck` clean.
Open PRs (3): **#885** (agent-memory UX docs + P6 — rewrites the dogfood INDEX.md), **#864**
(changesets: `@nlqdb/cli` utm republish), draft **#719** (oldest, **17 days**). #888 (reach
`/solve` linking) merged since run 160.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (RUM/GSC fresh live 2026-08-03; users/DBs carried from 07-27 remote-D1 — no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **188 pl / 186 vis** raw (07-27→08-03 live, `bun scripts/rum-pull.ts`). **Real-browser floor 42 pl / 41 vis** (was 40); synthetic 146 pl. Real-browser landings led by `nlqdb.com/` (7), **`/blog/guard-advertised-capabilities-against-code/` (6)**, **`/agents/` (6)**, `docs…/agent-memory/` (4), SDK-reference pages. Client mix real-browser: Chrome·SG 18, Chrome·US 11, MobileSafari·US 3, plus ChromeMobile·MX/Firefox/Edge. Header reports SAMPLED at interval ≤1.030 even on 7d — counts are effectively unscaled estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed**. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster unchanged; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs. Queue **2** (< the 3-deep forced-publish threshold — and a null run skips step 3 entirely); drafting skipped | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate. GSC sitemap: 117 submitted / 0 indexed reported, 0 errors |
| 7 | Surface yield | posts **37** (no change). GSC live this run: **Google (28d, 07-04→08-01): 8 clicks / 562 impr / pos 19.3** (run 160: 8 / 577 / 19.0 — **flat**, window shifted 1 d). Clicks concentrated — **`/security/hall-of-fame/` 4 of 8** (14 impr, pos 13.6). **Strengthen-next #1 `/solve/running-total-cumulative-sum-in-sql/` still 114 impr / pos 36.4 / 0 clicks** (run 157's target — no rerank yet) · **#2 `/solve/find-rows-with-no-match-in-another-table/` still 41 impr / pos 16.7 / 0 clicks** (run 159's target — no rerank yet). Highest-impression page-1 page `/solve/count-rows-per-day-including-missing-dates/` 82 impr / pos 8.4 / 1 click. **Wedge index-status: 3 indexed / 6, 2 NEVER-CRAWLED** (`build-vs-buy-agent-memory`, `expire-old-agent-memory` — #888 just added crawl-priority links). **First-party referral (live 08-03): 11 pl / 2 referrers** — google 6, bing 5; top landing **bing → `/blog/guard-advertised-capabilities-against-code/` (4 pl)** | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **8 d old, staleness trigger not fired** (< 7 d threshold was for the *last-measured* freshness; now 8 d, dark per rule 8). Full-run confirmed | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence) |
| | **Ops** — 7d, CF Workers analytics (carried 07-27 09:25Z; not the lever this run) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers**, carried |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. p50 is **not** `/ask` — account-level dist dominated by cheap routes; an `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **~0.21** (recomputed 08-03 — pure time-decay since the 07-28 0.420, no suite re-dispatched; suites are `workflow_dispatch`-only and can't run from a `/daily` container). Last successes: mcp ✅ 07-25 · sdk ✅ 07-24 · examples ✅ 07-24 · **opencheck 0** (last ✅ 07-17 ⇒ 17 d, freshness floored — NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely time-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 08-03, pinned grep, unchanged). Distribution: elements 2; agent-memory-pivot / cli / docs-site / e2e-coverage / events-pipeline / gtm-metrics / quality-eval 1 each. **This run confirmed all 9 are genuinely blocked/deferred/infra-gated** (operator tokens, future slices, external prereqs, #885 overlap) — none value-decidable + unblocked now, so none is a pullable lever this run (forcing one would violate D1/D2) | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (carried from run 160's fresh sweep: 127 pages, 3,268 internal + 15 cross-app links, `_redirects` 116 bare-path 301s — no built-surface change this run) | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths, published npm entrypoints (row #19), `www.` host un-redirected (zone Redirect Rule ⇒ console), link-less pages |
| | **Product-readiness** — client-blocking gaps | | |
| 19 | Live-surface claim integrity | **0** — `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1` verified installable (manifest → `dist/`); `ERR_MODULE_NOT_FOUND` class gone. Phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) all 0 | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; **not re-walkable from a `/daily` container** (`@playwright/test` pins Chromium 1223, image ships 1194 ⇒ `Executable doesn't exist`). CI-only until they agree. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP, `SK-ANON-012`) | target **0 `failed`** ✅; `blocked` reported beside it, never folded in |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. npm attribution reaches the registry for 2 of 3 packages (`@nlqdb/sdk@0.2.2`, `@nlqdb/mcp@0.1.1` tagged `?utm_source=npm`); **`@nlqdb/cli@0.1.0` laggard** — its `?utm_source=npm` republish rides open **PR #864** (changesets, needs no human). MCP registry published 07-22; Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19; `source_json` non-null **0**, for want of strangers | **weekly focus: → ≥ 5 live.** Growth comes only from not-yet-live channels (R-05 registries, human-norm venues — queue #3–6, founder-blocked) |
| | **Human queue** — the one non-automatable actor | **depth 6**; head is the Show HN launch, oldest bullet **51 days** (`SK-PIVOT-016` gate **0/5**); #2 `NLQDB_API_KEY` secret, #3 Glama badge, #4 community-plugin-directory, #5 connector directory (money-gated), #6 skillsclaude.org paste | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 3, oldest 17 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **1/7** (D-03 ✅) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; E-09 P1-blocked). D-02 🟡 (D-02a shipped run 160; D-02b blocked) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md) — note: #885 rewrites this INDEX |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 07-29, `resumable:false`. Weak axis: **temporal 2/7 (synthetic 2/3, ops 0/4)** — gates `SK-PIVOT-016` criterion 4; lever E-09 ⛔ P1-blocked (GLOBAL-037) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (161):** null run — no new surface shipped (step 3 skipped, see below). Last canonical
  blog post remains run 151's `/blog/guard-advertised-capabilities-against-code/` — which is now the
  top real referral landing this week (4 bing pl, row #7).

## Last change

**2026-08-03 (run 161)** — **NULL RUN. No lever cleared the bar; the deliverable is this
scorecard's fresh measurement + the finding.** No scorecard number moved by design.

**The finding — why no lever is pullable this run.** The weekly-focus number
(`SK-PIVOT-016` dogfood gate **0/5**) is **triply blocked**: (1) its near-term critical path
(D-02b → D-04, criteria 1/2/3) needs the founder-only **`NLQDB_API_KEY`** repo secret
(`blocked-by-human` #2, since 08-01) *and* the D-02b workflow's tracker lives in the dogfood
**`INDEX.md`**, which open **PR #885** is actively rewriting (step-0 says never touch a file an
open PR changes); (2) criterion 4 (temporal, ops **0/4**) is **P1-blocked** — its only lever E-09
samples cell-values into the prompt, the exact egress
[`GLOBAL-037`](decisions/GLOBAL-037-schema-only-llm-egress.md) forbids; (3) criterion 5 (D-06)
depends on the same secret-gated D-04. **Every fallback lane is also blocked:** engine #8/#9 dark
(rule 8, offline levers exhausted); **distribution** — the top strengthen-next pages are either
comprehensive already (`/vs/metabase/` already answers "top 10 products by revenue"; the
consecutive-days/gap-fill /solve pages are complete) or **just-worked and not yet reranked**
(running-total still 114 impr/pos 36.4/0 cl from run 157; find-rows-no-match still 41 impr/pos
16.7/0 cl from run 159 — re-strengthening now is premature + unmeasurable), and breadth (internal
linking) was **just shipped by #888**; **docs-ambiguity** (row #17) — all 9 open-question bullets
are genuinely blocked/deferred/infra-gated, so resolving one would violate D1/D2; **UX-flow** walkers
can't run from a `/daily` container (row #21).

**Measure → change → re-measure.** Fresh pulls this run: RUM real-browser floor **42 pl / 41 vis**
(was 40), 11 referral pl (google 6 / bing 5); GSC **8 cl / 562 impr / pos 19.3** — flat vs run
160's 8 / 577 / 19.0, confirming the 157/159 strengthens have produced no rerank movement in-window
yet (the evidence that re-pulling that lever now is premature). Rule 6 re-verified GREEN
(`main@c94bb7a8`: CI + Security + 9 Deploys all success). **Consecutive nulls: 1** (run 160 was
non-null) — the four-null proposal rule (`/daily` step 2) is not triggered. **Step 3 skipped**
(null run: no publish, no dev.to drip). **KPI (GLOBAL-025):** none advanced, **none degraded**
(measurement-only).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
