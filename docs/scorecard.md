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
**Superseded 2026-07-28 (window had lapsed 07-25):** acquisition — channels live with
attributable yield 2 → ≥ 5 (row #22, now 4), founder directive 2026-07-19
([`GLOBAL-038`](decisions/GLOBAL-038-gtm-pmf-instrumentation.md)); channel truth in
[`research/acquisition-channels.md`](research/acquisition-channels.md), yield truth on
`/app/admin`, never estimated. Acquisition levers stay pullable when no dogfood lever
is — as does premium-chain work (`SK-LLM-017`, row #20), one rank below.

**Worst number today:** **the human queue — depth 6, top bullet (`MEMORY_PRESET`) 2
days old, the launch-sequence bullet idle 46 days.** With real strangers at 0, the
age of this queue's head is the company's real cycle time, and the one bullet that can
move strangers off 0 (`SK-PIVOT-016`) has sat since 06-13. No agent run can clear it —
it is a founder decision (rule 4). So this run took the highest-yield **agent-movable**
lever instead (below).
**Why this dogfood-gate lever (step-2 top priority — the weekly focus itself).** The
weekly focus is the `SK-PIVOT-016` dogfood gate; its one criterion pullable while
`MEMORY_PRESET` is dark is **criterion 4 (temporal golden queries)**, owned by
[`D-03`](features/agent-memory-pivot/worksheets/dogfood/D-03-golden-queries.md) — offline
eval work, no prod flag, no Neon. D-03's dataset (12 repo-ops questions, 4 temporal) had
already **shipped in #847** but was **never measured**: the scorecard's memory-quality
number was still run 69 (15 synthetic questions only, 93.33%), so the ops corpus the
launch gate depends on was a *vibe*, not a number. This run supplied the missing half —
dispatched [run 30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690)
(free lane, `main@5cc4bd1`, clean: `transport_failed:false resumable:false`) over the full
27-question set. **Number moved: memory-quality (Engine lane) 15-q synthetic-only →
27-q synthetic+ops, first-ever ops EX; criterion 4 from *unmeasured on ops* → measured
temporal 2/7 (synthetic 2/3, ops 0/4).** It breaks the distribution anti-rut streak (runs
149–151), and touches `tools/eval` docs + the dogfood worksheets + `launch-gate.ts` —
files none of the 3 open PRs change. The result names the next lever: all four ops
temporal golds miss on the free chain (each miss's SQL is in the run summary).
**Top `blocked-by-human` bullet:** decide `MEMORY_PRESET` in prod (⏱ ~5 min, **2 days
old**, PR #835). The launch-sequence bullet — the only one that can move real
strangers off 0 — is **idle 46 days since 06-13**; its `SK-PIVOT-016` gate is **0/5
green** (no ops workload on the public MCP surface yet ⇒ criteria 1–3 unstartable;
criterion 4 now measured but red — temporal 2/7; `/agents` memory dashboard unshipped).
Every criterion is agent-movable and `MEMORY_PRESET=1` is criteria 1–3's prerequisite —
which is the top bullet.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider
0.2222**; rows **#4/#5/#16**'s stranger-dependent criteria (N = 0 until the launch
bullet fires); row **#15**'s opencheck arm (free-lane saturation, remedy costs money
⇒ rule 4).

**Rule 6 clean** — `bun run typecheck && bun run lint && bun run test` **green on
`main@5cc4bd1`** (EXIT=0, full workspace, re-run this run before any edit); **all 8
`deploy-*` workflows green on `5cc4bd1`** (2026-07-29). Local gates on the touched scope:
memory-quality gold-executability **27/27**, its guard test **24 pass**, and
`launch-gate.test.ts` green after the criterion-4 constant sync.
Open PRs **3** — **#835** (`MEMORY_PRESET` flip, founder go/no-go), **#826** (changesets
release), draft **#719** (oldest, **12 days**). This run's files (`scorecard.md`, the
dogfood `INDEX.md`/`D-03`, `admin/launch-gate.ts`+`.test.ts`) overlap none of them.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (RUM + referral re-pulled live 07-28 ~09:22Z; users/DBs carried from 07-27 remote-D1 — roster stable, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **248 pageloads / 248 visits** raw (07-21→07-28 live, `bun scripts/rum-pull.ts`). **Real-browser floor 36 pl / 36 vis**; synthetic 212 pl. Real-browser landings led by `nlqdb.com/` (16), **`/agents/` (4)**, `/security/hall-of-fame/` (2), docs SDK-reference pages. Header reports SAMPLED at interval ≤1.023 even on the 7d window — at that interval counts are effectively unscaled, but read them as estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + **`/blog` 37 ← this run, was 36**); **117** sitemap URLs, **127** built pages. Queue **2** — publishing the oldest draft dropped it from 3 (over threshold) to below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (flat this run — engine-lane run, no publish). GSC carried from run 150 (same-day pull): **Google (GSC 28d, 06-27→07-25): 8 clicks / 496 impr / pos 16.9**; 100 pages / 586 impr. Clicks concentrated: **`/security/hall-of-fame/` = 4 of 8** (11 impr, pos 13.5; #844 added a body CTA — next pull tests onward conversion). Strengthen-next, top 3 off page 1: **`/solve/running-total-cumulative-sum-in-sql/` 72 / 36.3** · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3 · `/vs/` 18 / 17.9. First-party referral: 5 pageloads / 3 referrers (google 2 → hall-of-fame, baidu 2 → `/blog/`, bing 1 → `/`) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **1.7 d old, staleness trigger not fired**. This run verified the run's *completeness* rather than re-reading the score: its `Save full-run checkpoint` step is **`skipped`**, which per `SK-QUAL-011` happens only after a finished run deletes its checkpoint — one 38-min window, not six. The EX figure itself is run 146's read of that report | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) (`d961475`) exited **partial** — its `Save full-run checkpoint` step **ran**, so a `SK-QUAL-013` budget-stop left a checkpoint behind | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-09, [run 29049936004](https://github.com/nlqdb/nlqdb/actions/runs/29049936004)) | full-chain ICP EX; the GLOBAL-026 bet; N=23 ±1 noisy |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 18.66 pts** (free 50.67% → agentic 69.33%, 150-q smoke, 07-06, `SK-QUAL-022`) | Δ ≤ 25 pp ✓ but agentic ≈ 0.69 < the 0.80 floor (row #16 fails on competence, not instrument) |
| | **Ops** — 7d, CF Workers analytics (live 07-27 09:25Z) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | **2,185 / 0** (0.00%) | mcp-server 1,627 / 0; web 11,310 / 0; events-worker 3 / 0 — **zero errors across all four workers**, 5th consecutive run |
| 13 | nlqdb-api wall-time p50 / p95 | **p50 16.4 ms / p95 1.48 s** (p99 1.69 s) | mcp-server p50 691.3 ms / p95 1.30 s. Read p95: the account-level distribution is dominated by cheap routes, so p50 is **not** `/ask` — an `/ask`-only split needs Grafana `metrics:read` (run 143's correction) |
| 14 | $ spend | ~$0 | free tiers |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **mcp 0.576** (✅ 07-25) · **sdk 0.553** (✅ 07-24) · **examples 0.553** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 11 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another consumer of its lanes. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **10** (re-counted live 07-27, pinned grep; **+1 vs 9**). The new one is `mcp-server`'s `sk_live_*`-as-MCP-credential question, already mirrored as founder queue bullet #3 — a founder-only call, so it is queue depth, not agent backlog. Rest: elements 2; agent-memory-pivot / anonymous-mode / cli / docs-site / e2e-coverage / events-pipeline / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); pullable only under a step-2 priority-3 waiver |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on a fresh build this run: **127** pages, **3,268** internal + **15** cross-app links, `_redirects` carrying 116 bare-path 301s. The new `/blog` post's links resolve clean | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Four standing blind spots: external inbound links to bare paths (≥107 impr), published npm entrypoints (row #19), **hosts** not paths (`www.nlqdb.com` serves the whole site un-redirected — bounded, `rel=canonical` is absolute; fix is a zone Redirect Rule ⇒ console click), and pages with no links at all (run 145) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **1 open, fixed in-repo, awaiting republish.** Checked live on the registry this run: `@nlqdb/sdk` latest is still **0.2.1**, so every surface telling a reader to `npm i @nlqdb/sdk` still hands them an `ERR_MODULE_NOT_FOUND`. #823 fixed + guarded the manifests; returns to 0 when **`0.2.2` reaches the registry — release PR #826 open, unmerged 3 days**. `@nlqdb/mcp` is live at **0.1.0** (0.1.1 waits in the same PR). The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) are unchanged | target 0 |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). Each carries its ledger `utm_source` in-repo; **npm's does not reach the registry** and the SDK install is broken (row #19) until #826 merges. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 6**, head ⏱ ~5 min · **2 days old**; oldest bullet 46 days (`SK-PIVOT-016` gate **0/5**, criterion 4 now measured) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs **3**, oldest 12 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **1/7** (D-03 ✅) — gate **0/5** (criterion 4 measured this run: temporal 2/7 = synthetic 2/3 + ops 0/4, not yet green) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). D-01 🟡 in flight; **D-03 ✅ done 07-29** (first ops-corpus EX); D-07 ⛔ blocked on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. **First dispatch over the full set (15 synthetic + 12 repo-ops docs→memory questions) — NOT a regression from the old 15-q 93.33% (run 69), a broader+harder denominator that finally measures the workload the launch gate depends on.** Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (151):** [`/blog/guard-advertised-capabilities-against-code/`](https://nlqdb.com/blog/guard-advertised-capabilities-against-code/)
  — integrity/testing lesson (advertise only verbs the shipped artifact registers;
  closed-world, every surface). dev.to mirror this run:
  https://dev.to/omer_hochman/ai-made-the-internal-tool-builder-faster-it-didnt-ask-whether-you-needed-the-tool-32ea
  (the `ai-internal-tool-builder-faster` variant — oldest pending, SK-BLOG-003 drip).

## Last change

**2026-07-29 (run 152)** — **Number moved: the memory-quality Engine-lane row —
15-q synthetic-only (run 69, 93.33%) → 27-q synthetic+ops, first-ever ops-corpus EX**
([run 30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690): free-chain EX
**59.26% (16/27)**, p50 1074 ms / p95 4406 ms, clean). This is the **weekly-focus**
`SK-PIVOT-016` gate's **criterion 4**, moved from *unmeasured on the ops corpus* →
**measured: temporal 2/7 (synthetic 2/3, ops 0/4)**. Lane: **dogfood gate = step-2 top
priority** (the weekly focus), the D-03 slice.

**Not a regression.** The old 93.33% measured only the 15 synthetic questions; the 59.26%
is the first run that also includes the 12 harder repo-ops docs→memory questions
(references, joins, date arithmetic) the launch actually rides on — a broader, harder
denominator, not a quality drop. Per-axis (free): consolidation 4/5, analytical 4/5,
retrieval 3/5, forgetting 3/5, **temporal 2/7 (weakest)**.

**Why this lever.** The dogfood gate is the founder-set weekly focus; D-03 is its one
criterion pullable while `MEMORY_PRESET` is dark (offline eval, no prod flag). Its dataset
had shipped in #847 but was never dispatched, so the scorecard still carried the stale
synthetic-only number. Dispatching + recording it closes that gap and **names the next
lever**: all four ops temporal golds (Q17 age>30d, Q18 supersession, Q19/Q20 ordering)
miss on the free chain — an engine/prompt fix, each miss's SQL in the run summary. Breaks
the runs 149–151 distribution anti-rut streak.

**No new `SK-*`** (P5/D5): D-03 is an existing worksheet slice under `SK-PIVOT-016` /
`SK-QUAL-023`; the corpus-vs-snapshot deviation is recorded in the D-03 worksheet, not a
new decision.

**Gates:** `typecheck && lint && test` green on `main@5cc4bd1` before edits · all 8
`deploy-*` green on `5cc4bd1` · memory-quality gold-executability **27/27** · its guard
test **24 pass** · `launch-gate.test.ts` green after the criterion-4 constant sync · **D4**
every edited doc under 20480 B.
**KPI (GLOBAL-025):** advances **engine quality** — the wedge's own memory-quality number
now measures the ops corpus honestly and localises the weak axis (temporal); **degrades
none** (a measurement, no baseline touched; BIRD/Spider/persona-bench untouched).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
