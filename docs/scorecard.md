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

**Worst number today (run 154, 2026-07-29):** **the `SK-PIVOT-016` dogfood gate — 0/5
green** (the founder-set weekly focus). Its prod prerequisite **cleared today**:
`MEMORY_PRESET=1` shipped to `main` (#835, in `cce51a6` history; Deploy API green), and
the founder's 2026-07-29 advisor session also merged the release PR #826 (`@nlqdb/mcp@0.1.1`
+ `@nlqdb/sdk@0.2.2`), wired LogSnag, fixed the sharp CVE, and minted the `sk_mcp_` walker
key — #865 (merged) reconciled the human queue **6 → 2**, since nudged to **3** by a new
Glama-release bullet. But the gate still has **no pullable slice this run**: D-01
(docs→memory skill) is unmerged on `claude/docs-memory-skill`, D-02 chains off it, D-03 was
taken today by #857, and D-04+ chain off D-01. So this run took the highest-yield
**agent-movable, non-overlapping** lever instead (below).
**Why this UX-integrity lever (step-2 priority 2).** With the dogfood gate unpullable,
distribution already worked today by runs 152/153 + reach #862/#863, and anti-rut
discouraging a 5th-of-6 distribution copy lever, the pullable lever is a real
anonymous-stranger-flow hardening: the `SK-ANON-015` nav guard was **per-file** — one
`attachHandoff(` cleared the whole file, so a second unprotected cross-origin hop could
silently drop a stranger's first prompt during the marketing→app handoff and stay green
forever. Tightened to per-navigation for the `/app/`-literal hop (`client-nav-integrity.test.ts`),
resolving anonymous-mode open-question #17 (10 → 9). Touches the anon nav test +
`anonymous-mode/FEATURE.md` — files **no open PR changes**.
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 46 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (**0/5**). Every criterion is agent-movable; the
prod prerequisite is now clear, so the gate is the weekly-focus lane to drive as D-01 merges.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider
0.2222** (Spider **10 d** stale, > 7 d alert — resume-dispatch deferred: async multi-window,
a 07-27 partial checkpoint exists on `d961475`, `main` has since moved); rows
**#4/#5/#16**'s stranger-dependent criteria (N = 0 until the launch bullet fires); row
**#15**'s opencheck arm (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 clean** — after `bun install`, `bun run typecheck && bun run lint && bun run test`
**all EXIT=0 on `main@cce51a6`** (full workspace; the bare-repo `TS5101 baseUrl` /
`bun-types` errors were a not-yet-installed artifact, cf. #860, since merged). **All nine
`deploy-*` workflows green on `cce51a6`** (web, api, docs, mcp, events-worker verified).
Touched-scope gate: the anon nav-integrity suite **5 pass** (was 4 + this run's
per-navigation `/app/`-literal case), and a negative check confirmed it flags an injected
unwrapped `location.assign("/app/…")`.
Open PRs — this run's cluster siblings (#857/#858/#859/#860/#861/#862/#863/#865/#866)
merged this cycle; still open per GitHub: **#868** (/review command), **#864** (changesets
Version-Packages), draft **#719** (oldest, **12 days**). This run's files
(`client-nav-integrity.test.ts`, `anonymous-mode/FEATURE.md`) overlap none of them.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (RUM + referral re-pulled live 07-29 ~08:35Z; users/DBs carried from 07-27 remote-D1 — roster stable, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **246 pageloads / 246 visits** raw (07-22→07-29 live, `bun scripts/rum-pull.ts`). **Real-browser floor 34 pl / 34 vis** (flat vs 36); synthetic 212 pl. Real-browser landings led by `nlqdb.com/` (9), **`/agents/` (4)**, `/security/hall-of-fame/` (2), docs SDK-reference pages. Header reports SAMPLED at interval ≤1.023 even on the 7d window — at that interval counts are effectively unscaled, but read them as estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + **`/blog` 37 ← this run, was 36**); **117** sitemap URLs, **127** built pages. Queue **2** — publishing the oldest draft dropped it from 3 (over threshold) to below the 3-deep forced-publish threshold | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change this run). GSC carried from run 150: **Google (28d, 06-27→07-25): 8 clicks / 496 impr / pos 16.9**; clicks concentrated — **`/security/hall-of-fame/` is 4 of 8** (11 impr, pos 13.5), the surface #844 gave a body CTA. Strengthen-next, top 3 off page 1: `/solve/running-total-cumulative-sum-in-sql/` 72 / 36.3 (declined) · `/solve/find-rows-with-no-match-in-another-table/` 31 / 14.3 · `/vs/` 18 / 17.9. **First-party referral (live 07-29): 4 pl / 2 referrers** (google 2 → hall-of-fame, baidu 2 → `/blog/`) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
| | **Engine** — BIRD 07-26 · Spider 07-19 · persona-bench 07-09 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.5382** (268/500, 07-26 canonical on `d961475`, [run 30212657876](https://github.com/nlqdb/nlqdb/actions/runs/30212657876)) — **3 d old, staleness trigger not fired** (< 7 d). Full-run confirmed (`Save full-run checkpoint` skipped ⇒ checkpoint deleted, `SK-QUAL-011`) | target 0.65 / **Phase 2 floor 0.60** — gap 6.2 pp. Offline levers exhausted; SC dead (#619) |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (re-counted live 07-29, pinned grep; **−1 vs 10** — this run resolved anonymous-mode's `SK-ANON-015` per-navigation nav-guard question, GLOBAL-033). Rest: elements 2; agent-memory-pivot / cli / docs-site / e2e-coverage / events-pipeline / gtm-metrics / quality-eval 1 each | target ↓ 0. **Method pinned:** `- ` bullets under `## Open questions` not matching, case-insensitively, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly); this run's is a real UX-flow-integrity hardening (priority 2), not a meta pull |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** — re-swept live on a fresh build this run: **127** pages, **3,268** internal + **15** cross-app links, `_redirects` carrying 116 bare-path 301s. The new `/blog` post's links resolve clean | target 0 — `node apps/web/scripts/check-links.mjs` + `client-nav-integrity.test.ts`. Four standing blind spots: external inbound links to bare paths (≥107 impr), published npm entrypoints (row #19), **hosts** not paths (`www.nlqdb.com` serves the whole site un-redirected — bounded, `rel=canonical` is absolute; fix is a zone Redirect Rule ⇒ console click), and pages with no links at all (run 145) |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 — resolved this cycle (was 1).** `#826` merged + published **`@nlqdb/sdk@0.2.2`** and **`@nlqdb/mcp@0.1.1`**. Verified live in a clean dir: `npm i @nlqdb/sdk@0.2.2` installs a tarball whose manifest is correct (`main`/`types`/`exports` → `dist/`, `files: ["dist"]`, README), `import "@nlqdb/sdk"` yields `NlqdbApiError, createClient`, and `types` resolves to the shipped `dist/index.d.ts` — the `ERR_MODULE_NOT_FOUND` class is gone for every consumer. (`npm view` shows src-pointing `main`/`exports`; that is a cosmetic **packument** artifact — the installed tarball, which is what npm resolves, carries the `prepack`-applied `dist` values.) The 0-phantom sweeps (`mcp-tool-`/`cli-verb-`/`sdk-method-integrity`) unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). npm attribution now **reaches the registry for 2 of 3 packages**: `@nlqdb/sdk@0.2.2` (`?utm_source=npm`) and `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`) both verified live this cycle; **`@nlqdb/cli@0.1.0` is the laggard — still an untagged `https://nlqdb.com`**, so this run queued its republish changeset (`@nlqdb/cli` patch) to close the last third. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 3** (advisor session cut it 6 → 2; a Glama-release bullet since); head is the Show HN launch, oldest bullet 46 days (`SK-PIVOT-016` gate **0/5**) | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: see GitHub, oldest 12 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **1/7** (D-03 ✅) — gate **0/5** (criterion 4 measured this run: temporal 2/7 = synthetic 2/3 + ops 0/4, not yet green) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). D-01 🟡 in flight; **D-03 ✅ done 07-29** (first ops-corpus EX); D-07 ⛔ blocked on D-04 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. **First dispatch over the full set (15 synthetic + 12 repo-ops docs→memory questions) — NOT a regression from the old 15-q 93.33% (run 69), a broader+harder denominator that finally measures the workload the launch gate depends on.** Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (153):** no new post — the lever was the npm-channel attribution republish
  (queued via changeset, not a blog surface); distribution queue at 2 (< 3, no forced
  publish); dev.to drip throttled (newest article 15.4 h ago < 20 h). Last shipped post
  remains run 151's `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-07-29 (run 154)** — **Number moved: open-question bullets 10 → 9** (row #17):
resolved anonymous-mode's `SK-ANON-015` per-file-vs-per-navigation nav-guard question
(GLOBAL-033 — a value-decidable call an agent owns). Lane: **UX-flow integrity (step-2
priority 2)** — hardening the real anonymous-stranger marketing→app handoff, not a meta pull.

**The hole (before).** `SK-ANON-015` carries a stranger's prompt across the
`nlqdb.com → app.nlqdb.com` origin boundary in a URL fragment via `attachHandoff(`; the
guard (`client-nav-integrity.test.ts`) checked it **per-file** — one `attachHandoff(`
anywhere cleared the whole file. So a second, unprotected cross-origin `/app/` hop added
later would silently drop the visitor's first prompt on the floor and the guard would stay
green forever (the exact failure that wastes an acquired visitor).

**The change.** Added the narrow, false-positive-free invariant: any JS `location.*`
navigation whose *string-literal* target is `/app/…` must wrap it in `attachHandoff(`.
Static `<a href>` anchors (goal rides a sibling JS interceptor) and variable-target
same-origin hops in `sign-in.astro` never match the shape, so **no inline-suppression
mechanism** is needed — which is what the open question asked. The broad "every navigation"
rule stays rejected (it false-positives on exactly those). Resolution recorded in
`anonymous-mode/FEATURE.md`; full rationale canonical in the test comment (P3).

**Measure → change → re-measure.** Before: nav-integrity suite **4 pass**, guard per-file.
After: **5 pass**; a negative check (injected `location.assign("/app/dashboard")` into a
prompt-touching file) **failed** exactly one navigation with `navigates to /app/dashboard
without attachHandoff`, then reverted clean. Row #17 re-counted live: **10 → 9**.

**No new `SK-*`** (P5/D5): this tightens an existing guard under `SK-ANON-015` and resolves
its own open question; the test comment is the one canonical rationale home.

**Gates:** after `bun install`, `typecheck && lint && test` all **EXIT=0 on
`main@cce51a6`** before edits · all nine `deploy-*` green on `cce51a6` · anon nav suite
**5 pass** + negative check · biome clean on the touched `.ts` · gate-3 grep empty · **D4**
`anonymous-mode/FEATURE.md` net-shrunk (32016 → 32015 B), scorecard < 20480 B.
**KPI (GLOBAL-025):** advances **onboarding/UX** — closes a silent regression path in the
anonymous first-prompt handoff; **degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
