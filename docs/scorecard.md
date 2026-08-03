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

**Worst number today (run 160, 2026-08-02):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
— and this run worked it. Its whole critical path (criteria 1/2/3 via D-04, criterion 5 via D-06)
funnels through **D-02 → D-04**, and D-02 turned out **mis-scoped**: D-01 shipped only an
agent-executed *skill*, so there was **no runnable producer** for CI (and CI can't run an agent for
`$0`, rule 4). This run built it — **D-02a: `tools/docs-memory/`**, a deterministic no-LLM extractor
(**9 open-question + 6 blocked facts, 14 entities** offline over live `docs/`; the 9 cross-checks
row #17). Criterion **4** stays the measured weak axis (memory-eval temporal, ops 0/4) with its lever
**E-09 ⛔ P1-blocked** ([`GLOBAL-037`](decisions/GLOBAL-037-schema-only-llm-egress.md), PR #883). See
Last change. Distribution (row #7: **8 clicks / 577 impr / pos 19.0**, GSC 28d, carried from run 159)
stays the acquisition-lane worst number but is one rank below the weekly focus and crowded (open PR
#888 works `/solve`), so not this run's lever.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5** — D-02b (convergent sync +
workflow) now blocks on a read-verb decision + the `NLQDB_API_KEY` secret (queue #2).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 50 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate. Queue **depth 6**; head age 50 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider 0.2222** (**14 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4).

**Rule 6 — GREEN.** `main@a0b66b8` CI all **success** (latest 3 pushes green); recent merges are
docs-only ⇒ no deploy-triggering change since run 157's verified-green Deploy web/API/Canary. This
run's branch head: `bun install` clean · new workspace `@nlqdb/docs-memory` `typecheck` EXIT=0 ·
`biome lint tools/docs-memory/src/` clean · `bun test` **12 pass / 0 fail**.
Open PRs (4): **#888** (reach R-02/R-03 `/solve` linking), **#885** (agent-memory UX docs),
**#864** (changesets), draft **#719** (oldest, **16 days**). This run's files (`tools/docs-memory/**`
+ dogfood D-02 docs) overlap **none** of them.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (RUM/GSC carried from run 159's live 08-02 ~09:16Z pull — same day; this run worked the weekly-focus dogfood lane, not distribution. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **181 pageloads / 179 visits** raw (07-26→08-02 live, `bun scripts/rum-pull.ts`). **Real-browser floor 40 pl / 39 vis**; synthetic 141 pl. Real-browser landings led by `nlqdb.com/` (7), **`/agents/` (6)**, `docs…/agent-memory/` (4), docs SDK-reference pages. Client mix real-browser: Chrome·SG 21, Chrome·US 9, plus MobileSafari/ChromeMobile·MX/Firefox. Header reports SAMPLED at interval ≤1.030 even on 7d — at that interval counts are effectively unscaled, but read them as estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs, **127** built pages. Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC live this run: **Google (28d, 07-03→07-31): 8 clicks / 577 impr / pos 19.0**; clicks concentrated — **`/security/hall-of-fame/` 4 of 8** (14 impr, pos 13.6). **Strengthen-next #1 = `/solve/running-total-cumulative-sum-in-sql/` — 114 impr / pos 36.4 / 0 clicks** (run 157's target; not re-pulled). **#2 = `/solve/find-rows-with-no-match-in-another-table/` — 41 impr / pos 16.7 / 0 clicks — this run's lever target** (page-query dimension fully GSC-anonymized ⇒ fixed a concrete on-page gap, not a query; see Last change). Next: `/vs/` 26 / 14.8 · `/vs/metabase/` 20 / 12.9. **First-party referral (live 08-02): 3 pl / 2 referrers** (google 2 → home, bing 1 → `/agents/`) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **4 d old, staleness trigger not fired** (< 7 d). Full-run confirmed (`Save full-run checkpoint` skipped ⇒ checkpoint deleted, `SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
| 9 | Spider raw EX | **0.2222** (30/135, 07-19 canonical on `04fa3d0`, [29682993836](https://github.com/nlqdb/nlqdb/actions/runs/29682993836)). The 07-27 re-dispatch [30230040001](https://github.com/nlqdb/nlqdb/actions/runs/30230040001) exited **partial** (checkpoint left behind, `SK-QUAL-013` budget-stop) | target 0.75. Worst engine number. No baseline file (BIRD-only, `SK-QUAL-018`) — this row is source of truth |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-29, pinned grep; **−1 vs 10** — this run resolved anonymous-mode's `SK-ANON-015` per-navigation nav-guard question, GLOBAL-033). Rest: elements 2; agent-memory-pivot / cli / docs-site / e2e-coverage / events-pipeline / gtm-metrics / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); count carried this run (no FEATURE.md open-question edited) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on a fresh build this run: **127** pages, **3,268** internal + **15** cross-app links, `_redirects` carrying 116 bare-path 301s. The new `/blog` post's links resolve clean | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Four standing blind spots: external inbound links to bare paths (≥107 impr), published npm entrypoints (row #19), **hosts** not paths (`www.nlqdb.com` serves the whole site un-redirected — bounded, `rel=canonical` is absolute; fix is a zone Redirect Rule ⇒ console click), and pages with no links at all (run 145) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 — resolved this cycle (was 1).** `#826` merged + published **`@nlqdb/sdk@0.2.2`** and **`@nlqdb/mcp@0.1.1`**. Verified live in a clean dir: `npm i @nlqdb/sdk@0.2.2` installs a tarball whose manifest is correct (`main`/`types`/`exports` → `dist/`, `files: ["dist"]`, README), `import "@nlqdb/sdk"` yields `NlqdbApiError, createClient`, and `types` resolves to the shipped `dist/index.d.ts` — the `ERR_MODULE_NOT_FOUND` class is gone for every consumer. (`npm view` shows src-pointing `main`/`exports`; that is a cosmetic **packument** artifact — the installed tarball, which is what npm resolves, carries the `prepack`-applied `dist` values.) The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). npm attribution now **reaches the registry for 2 of 3 packages**: `@nlqdb/sdk@0.2.2` (`?utm_source=npm`) and `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`) both verified live this cycle; **`@nlqdb/cli@0.1.0` is the laggard — still an untagged `https://nlqdb.com`**, so this run queued its republish changeset (`@nlqdb/cli` patch) to close the last third. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 4**; head is the Show HN launch, oldest bullet **47 days** (`SK-PIVOT-016` gate **0/5**); #2 Glama badge push, #3 community-plugin-directory submit, #4 connector directory (money-gated) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 4, oldest 13 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **1/7** (D-03 ✅) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4, not yet green; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). D-01 🟡 in flight; **D-03 ✅ done 07-29** (first ops-corpus EX); D-07 ⛔ blocked on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. **First dispatch over the full set (15 synthetic + 12 repo-ops docs→memory questions) — NOT a regression from the old 15-q 93.33% (run 69), a broader+harder denominator that finally measures the workload the launch gate depends on.** Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (159):** no new blog post — the lever strengthened an existing `/solve` page (not a
  new blog surface); distribution queue < 3 (no forced publish); drafting skipped (P5). Dev.to
  drip (step 3.3): see Last change. Last canonical blog post remains run 151's
  `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-08-02 (run 160)** — **Number moved: the runnable docs→memory producer — a named direct input
to `SK-PIVOT-016` criterion 1 (the weekly-focus dogfood gate).** 0 → **15 structured facts (9
open-question + 6 blocked) + 14 entities** deterministically extractable offline from the live
`docs/` corpus. The 9 open-questions independently reproduce scorecard row #17's pinned count,
cross-validating the rule against the canonical method.

**The finding (why this was the lever).** The gate's whole critical path funnels through D-02 → D-04,
and D-02 was mis-scoped: **D-01 shipped only an agent-executed skill (`SKILL.md`), so no runnable
extractor existed** for CI to invoke — and CI can't run an agent for `$0` (rule 4). A subtler blocker
also surfaced: `facts` are **append-only** (`remember.ts` has no update verb), so idempotent re-sync
needs a deterministic **read-before-write** per `source.key`, and that read verb (`/v1/run` vs a keyed
`facts`-read) is unresolved (`ask()` is LLM-backed ⇒ `$`/non-deterministic). So the slice **splits**:
D-02a (this run) ships the producer; D-02b wires the authenticated convergent sync + workflow.

**The change.** New `$0`, no-LLM, no-network `tools/docs-memory/` workspace: `extract.ts` (pure core —
open-questions per feature + the blocked-queue, emitting `nlqdb_remember`-shaped entities/facts with
`source.{key,digest}` for convergence), `extract.test.ts` (12 tests: structure-only, parked/resolved
exclusion, idempotent digests), `sync.ts --dry-run` (offline yield report). D-02 worksheet + INDEX
re-scoped to the a/b split with the read-verb design question recorded (single-homed, P3).

**Measure → change → re-measure.** Before: no runnable producer (criterion 1 structurally
unstartable). After: `bun src/sync.ts` over live `docs/` prints 15 facts / 14 entities; a re-run over
an unchanged corpus yields byte-identical keys+digests (idempotency proven in tests). `typecheck` /
`lint` / `test` (12 pass) green. Remaining for the count to actually move: D-02b + the `NLQDB_API_KEY`
secret (queue #2).

**Step 3 (artifact):** distribution queue 2 (< 3) ⇒ no forced publish; drafting skipped (optional,
P5). Dev.to drip (3.3) skipped by its one-post/day guard (run 159 already posted today). **No new
`SK-*`** (P5/D5): the a/b split is a worksheet execution detail, not a decision. **KPI (GLOBAL-025):**
advances **engine-quality / onboarding** (unblocks the dogfood workload's producer); **degrades none**
(new isolated tool, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
