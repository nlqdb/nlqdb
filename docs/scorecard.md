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

**Worst number today (run 175, 2026-08-10):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
is still the worst number — but it is **no longer dark**: this run **pulled it**. Per the founder-directed
2026-08-09 live session recorded in **#961** ("next `/daily` ships the create change"), the gate's
create-boundary blocker is now **shipped** — **`SK-HDC-021`**: `POST /v1/databases` moves from
`requireSession` to `requirePrincipal`, so preset (`agent_memory_v1`) create accepts any account-scoped
principal (`user`/`sk_live`/`sk_mcp`); `anon`/`pk_live` stay rejected 403 and generic goal create stays
session-only. This closes the create-vs-write asymmetry (`/v1/memory/remember` already trusted `sk_` keys)
that was gating criteria 1/2/3 via **D-04**. **Measured delta:** `POST /v1/databases {preset}` with an
`sk_live`/`sk_mcp` key was **401 (session-only)** → now **admitted past auth** (proven by a post-auth,
pre-provision `invalid_preset` 400; happy path reaches Neon). The gate **stays 0/5 this run** — D-04 still
needs the prod `NLQDB_MEMORY_DB` repo var set + a real workload run (agent-movable next run, per #961's D-04
worksheet), and criterion 4 (ops-temporal 0/4) remains the separate E-09/GLOBAL-037 engine problem.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged this run — the create-boundary
prerequisite is cleared in code (pending merge of this PR + #961), so the next-run lever is D-04 execution.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 58 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (0/5). #2 = submit nlqdb to the Anthropic **connector
directory** (money-gated, since 07-21). #3 = approve the EK-03 ToS/DPA "not allowed" delta (⏱ ~15 min,
since 08-07, from /ek #923). Queue **depth 3**, head age 58 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (15 d) / **#9 Spider 0.2222** (**22 d**
stale — resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows **#4/#5/#16**
stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation, remedy costs money ⇒
rule 4); dogfood criterion 4 (E-09 GLOBAL-037-blocked). Dogfood criteria 1/2/3 **exit dark this run** — the
create-boundary was pullable and got pulled.

**Rule 6 — GREEN.** Branch based on `main@3b6e070` (ek #964). Health re-measured live this run: `bun install`
restored container-lost types; **`typecheck` exit 0**, **`biome lint` 0 new** (1 pre-existing warning on the
untouched `/v1/keys/:hash/status` handler), **full `apps/api` suite 1080 passed / 0 failed** (was 1041; +6
new create-boundary tests + growth). Diff is the API lever (`apps/api/src/index.ts`) + its test
(`apps/api/test/databases-create.test.ts`) + `vitest.config.ts` + docs (`SK-HDC-021` decision file, its
FEATURE index line, this scorecard regen). **Open PRs (3, checked step-0):** **#961** (weekly correction —
the docs authorization for THIS run's lever; **docs-only**, no file overlap with my code), **#955** (run-174
null, scorecard-only), draft **#719** (Infisical, oldest **24 d**). My lever touches **no** open PR's files
(#961 is docs — SK-PIVOT-010/blocked-by-human/worksheet — I touched none of them; scorecard regen is
step-0-exempt). This PR **depends on #961** landing the SK-PIVOT-010 amendment; merge order is the reviewer's.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel, bot-filtered** (RUM **re-pulled live 08-10** (`rum-pull.ts`, 7d, unsampled); GSC **re-pulled live 08-10** (`gsc-pull.ts`, 28d). Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **239 pl / 237 vis** raw, **real-browser floor 53 pl / 52 vis** (re-pulled 08-10; 186 synthetic cut). Window slid vs 63 pl (08-08) — 7d window advanced 2 days, not a regression. Real-browser landings led by `nlqdb.com/` (**26**), `nlqdb.com/` CN (10), `/vs/mem0/` (9), `/vs/vanna/` (9), `/vs/supabase/` (9) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}` or CF-classified bot ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **110** content pages (`/solve` 40 + `/vs` 31 + `/blog` 39); **123** sitemap URLs — **unchanged this run** (rule-7 measurement run, no new surface shipped). Unpublished blog drafts **0** (queue drained run 171) | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **39** (no new surface this run — this is a lever run, not a distribution run). **GSC re-pulled live 08-10** (`gsc-pull.ts`, 28d): **9 clicks / 599 impr / pos 19.7** — clicks +1, impressions slid −49 vs 08-08 (648) as the 28d window advanced, position flat. Top-impression page `/solve/running-total-cumulative-sum-in-sql/` **112 impr / pos 35.7 / 0 clicks** (still page-4, the biggest wasted-impression surface). Second: `/solve/count-rows-per-day-including-missing-dates/` **81 impr / pos 8.6 / 1 click** (page-1, converting). **Referral yield (RUM 08-10):** 5 pl from 3 external referrers. `http://…/count-consecutive-days-streak…` (22 impr) still indexed un-redirected — http→https is a zone/console setting ⇒ reported not pulled | `gsc-pull.ts` + `rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at low N |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **15 d old, staleness trigger fired** (> 7 d), but **dark (rule 8)**: resume is async multi-window and `main` has moved since the 07-27 checkpoint (SHA-keyed cache would miss). Full-run confirmed (`SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836), **22 d old**). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left behind, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **≈12** (unchanged — not this run's lever). #909 added `expert-knowledge-platform/FEATURE.md` with **5 forward-research bullets** — genuinely-deferred for a not-yet-built platform, so GLOBAL-033 "Parked until `<trigger>`" conversion is a **future** meta-run's fix; `/ek`-owned | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`, judged for genuine openness. Lane-3 meta — reported not pulled |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — swept run 166 live on `main`: **127 pages, 3,535 internal + 20 cross-app links**, all resolve. This run's diff is docs-only (no built surface changed), so #18 carries at target 0 | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.`/`http://` host un-redirected (zone Redirect Rule ⇒ console click — GSC now shows an `http://` solve variant indexed), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints. `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) concluded success. **Not re-walkable from a `/daily` container** (standing constraint): `@playwright/test` pins `~1.60.0` → wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub. npm attribution reaches the registry for all 3 packages (`@nlqdb/sdk@0.2.2`, `@nlqdb/mcp@0.1.1`, `@nlqdb/cli@0.1.1`, each `?utm_source=npm`). MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3**; head is the Show HN launch, oldest bullet **58 days** (`SK-PIVOT-016` gate **0/5**); #2 Anthropic connector directory (money-gated, 07-21); #3 EK-03 ToS/DPA approval (08-07, /ek #923) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: **3** — #961 (weekly, 1 d), #955 (run-174 null, 1 d), draft **#719** (oldest, 24 days) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879). **D-04 create-boundary blocker cleared in code this run (`SK-HDC-021`, pending merge)** — the "one API change from pullable" (#961) is shipped; D-04 now needs only the prod `NLQDB_MEMORY_DB` repo var + a workload run (agent-movable next run) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until D-04); D-07 ⛔ on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`. Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4 (the next engine lever, E-09-blocked) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**40 canonical `/solve` pages** + **39 `/blog` posts** + **31 `/vs` pages** live under `nlqdb.com/`
(`SK-SOLVE-001` / `SK-BLOG-001` / `SK-CMP-001`). The registries are `apps/web/src/data/{solve,blog,competitors}.ts`
— the one place each list exists; venue variants stay in `research/distribution-queue.md`.

- **This run (175):** no new surface — this is an **engine/UX lever run** (the dogfood create-boundary
  API change, `SK-HDC-021`), not a distribution run. Blog draft queue empty (drained run 171) ⇒ no
  forced-publish; dev.to drip self-throttled (`SK-BLOG-003` one-post/day guard, expected no-op).

## Last change

**2026-08-10 (run 175)** — **Lever run: shipped the dogfood create-boundary API change (`SK-HDC-021`).**
The weekly-focus `SK-PIVOT-016` gate had sat "dark, not pullable" — but #961 (founder-directed live session,
2026-08-09) established it was **one 1-run API change from pullable** and directed "next `/daily` ships the
create change." This run is that run.

**The lever (Lane-2 UX-flow / onboarding — the highest-priority pullable lever).** `POST /v1/databases`
moved from `requireSession` (cookie-only) to `requirePrincipal`. On the `agent_memory_v1` **preset path** it
now accepts any account-scoped principal — `user` session, `sk_live`, or `sk_mcp` — so nlqdb's own agents can
provision their memory DB with the repo's `sk_` service credential (the dogfood workload). `anon` and
`pk_live` stay rejected 403 `account_required` (SK-PIVOT-010 anon boundary preserved); the generic
LLM-inferred goal/name create stays session-only (`create_requires_session` 403 for non-`user`). This closes
the create-vs-write asymmetry — `POST /v1/memory/remember` already trusted `sk_` keys but create did not.

**Measured delta:** `POST /v1/databases {preset}` with an `sk_live`/`sk_mcp` key was **401** (route was
`requireSession`) → now **admitted past auth**, proven by six new seam tests in
`apps/api/test/databases-create.test.ts` (anon→403 `account_required`; `sk_`+preset→400 `invalid_preset` on a
bogus value, i.e. past auth; `sk_live`+generic→403 `create_requires_session`; unauth→401). Full happy path
reaches Neon (not provisionable in-process), so admission is asserted at the post-auth/pre-provision seam.
Dogfood criteria 1/2/3's create-boundary prerequisite (D-04) is **cleared in code** so the gate exits
rule-8 dark; count stays **0/5** — D-04 still needs the prod `NLQDB_MEMORY_DB` repo var + a workload run.

**Health re-measured green:** `typecheck` 0, `biome lint` 0 new (1 pre-existing warning, untouched handler),
`apps/api` suite **1080 passed / 0 failed** (was 1041). Rows #1 (RUM, floor 53 pl) + #7 (GSC, 9 clk / 599
impr / pos 19.7) re-pulled live 08-10.

**Doc dependency (P3).** The governing decision is SK-PIVOT-010 as amended 2026-08-09, whose amendment lands
in **#961** (docs-only, unmerged). This run records the code decision under a **new** `SK-HDC-021` in
hosted-db-create's canonical `decisions/` home (a file #961 does not touch) and does not edit any of #961's
files. This PR depends on #961; merge order is the reviewer's.

**Four-null check.** Runs 174 (null) / 173 (measurement). This run is a real delta ⇒ streak resets; no
four-null proposal territory.

**Step 3 (artifact):** blog queue empty (drained run 171) ⇒ no forced-publish; dev.to drip self-throttled
(one-post/day guard). **KPI (GLOBAL-025):** advances **onboarding** (the agent create on-ramp — the dogfood
gate's create-boundary now works for `sk_` keys) and **engine quality** (unblocks the memory-workload dogfood
lane); **degrades none** — narrow additive auth widening, all gates green, no other endpoint touched.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
