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

**Worst number today (run 157, 2026-07-30):** the **acquisition bottleneck — row #7 surface
yield: 7 clicks / 517 impr / pos 17.8** (GSC 28d 06-30→07-28, live this run). Rule 6 is GREEN
(`main@7fc102e` CI success), so the worst *agent-movable* number is distribution yield: the site
earns impressions but almost no clicks, and GSC confirms breadth-not-CTR is the ceiling. This
run pulled the canonical priority-1 lever — **strengthen the top strengthen-next page** (see
Last change). The weekly-focus dogfood gate (below) is one rank above but its next lever (E-09
schema value-linking) is a hot-path perf change already scoped in open PR #879, not a daily-sized
patch this run should duplicate.
**Weekly-focus gate (unchanged, don't overwrite mid-week):** `SK-PIVOT-016` dogfood gate **0/5**
— binding on **criterion 4** (memory-eval temporal axis, ops 0/4). Root cause diagnosed + scoped
as engine slice **E-09 (schema value-linking)** in open PR **#879**; not re-pulled here (step-0
overlap + hot-path scope).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 47 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (**0/5**, every criterion agent-movable). Queue
**depth 4**; head age 47 d is the company's real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** (4 d, < 7 d) / **#9 Spider
0.2222** (**11 d** stale, > 7 d alert — resume-dispatch deferred: async multi-window, `main` has
moved since the 07-27 partial checkpoint); rows **#4/#5/#16**'s stranger-dependent criteria
(N = 0 until the launch bullet fires); row **#15**'s opencheck arm (free-lane saturation, remedy
costs money ⇒ rule 4).

**Rule 6 — GREEN.** `main@7fc102e` CI job is **success** (run 155's fix #877 merged; five daily/
reach/dogfood PRs since all green on push). All six `deploy-*` green ⇒ production serves current
build. On this run's branch head: `bun install` clean · `bun run typecheck` all workspaces EXIT=0
· `bun run lint` touched file clean (41 warnings pre-existing, 0 errors) · touched-scope test
`apps/web/src/data/solve.test.ts` **15 pass / 0 fail**.
Open PRs (4): **#880** (reach R-05, acquisition ledger docs), **#879** (daily run 156, null —
scorecard + E-09 engine slice docs), **#864** (changesets release), draft **#719** (oldest,
**13 days**). This run's only file (`apps/web/src/data/solve.ts`) overlaps **none** of them.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (RUM + referral re-pulled live 07-30 ~09:17Z; users/DBs carried from 07-27 remote-D1 — no CF/D1 write-token this session to re-pull the roster, stable across runs 143–156, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **265 pageloads / 265 visits** raw (07-23→07-30 live, `bun scripts/rum-pull.ts`). **Real-browser floor 43 pl / 43 vis** (+9 vs 34); synthetic 222 pl. Real-browser landings led by `nlqdb.com/` (8), **`docs…/agent-memory/` (4)**, `/agents/` (4), `/security/hall-of-fame/` (2), docs SDK-reference pages. Client mix real-browser: Chrome·SG 24, Chrome·US 7, Chrome·IN 4, plus MobileSafari/Firefox. Header reports SAMPLED at interval ≤1.020 even on 7d — at that interval counts are effectively unscaled, but read them as estimates | the cut is a printed rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, with **every removed row listed** so a real visitor it swallows is visible. Conservative ⇒ real-browser is a floor. Read at **7d**: a 28d pull comes back sampled at interval 10 |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs, **127** built pages. Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC live this run: **Google (28d, 06-30→07-28): 7 clicks / 517 impr / pos 17.8**; clicks concentrated — **`/security/hall-of-fame/` 4 of 7** (14 impr, pos 13.6). **Strengthen-next #1 = `/solve/running-total-cumulative-sum-in-sql/` — 91 impr / pos 36.7 / 0 clicks** (highest-impression page still off page 1; this run's lever target — see Last change). Next: `/solve/find-rows-with-no-match-in-another-table/` 34 / 14.9 · `/vs/` 23 / 15.7. **First-party referral (live 07-30): 4 pl / 2 referrers** (google 3 → hall-of-fame + home, baidu 1 → `/blog/smoke-test`) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
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

- **This run (157):** no new blog post — the lever strengthened an existing `/solve` page (not a
  new blog surface); distribution queue at 2 (< 3, no forced publish); drafting skipped (P5).
  Dev.to drip (step 3.3) **throttled no-op** — newest article 15.9 h ago (< 20 h guard), expected
  on all but the first run of the day; queue line untouched. Last canonical blog post remains
  run 151's `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-07-30 (run 157)** — **Number moved: query-intent coverage on the top strengthen-next
page — a named direct input to row #7 surface yield.** GSC (live this run) shows
`/solve/running-total-cumulative-sum-in-sql/` is the **highest-impression page still off page 1
— 91 impr / pos 36.7 / 0 clicks** (the canonical priority-1 "strengthen the page GSC shows losing
winnable clicks" lever). The page was written Postgres-only, yet GSC records it ranking — poorly —
for two intents it never answered on-page: **dialect** ("cumulative sum snowflake", pos 39) and
**definitional** ("cumulative total meaning", pos 85).

**The change.** Two FAQs appended to that entry in `apps/web/src/data/solve.ts` (4 → 6 FAQs),
each mapping to one unmet GSC query and rendered into both visible content and the page's
`FAQPage` JSON-LD: (1) *"What does a running total (cumulative sum) actually mean?"* — the
definition + the grand-total contrast; (2) *"Does the running-total query work in Snowflake,
BigQuery, or MySQL?"* — honest: the `SUM() OVER (ORDER BY)` pattern is ANSI-standard and portable,
nlqdb runs it on Postgres today. No new capability claim; no other page touched.

**Measure → change → re-measure.** Before: 4 FAQs (how / GROUP BY / BYO / moving-avg); dialect +
definitional intent unanswered on-page; baseline pinned pos 36.7 @ 91 impr / 0 clicks. After:
6 FAQs, both long-tail intents answered + 2 new `FAQPage` entries; `solve.test.ts` 15 pass
(FAQ ≤ 80-words + no-ID-leak guards green). Ranking re-measure is a next-week GSC read against the
recorded baseline (position moves are not same-day — the SK-LLM-036 rule for engine work; for
distribution work the tracked baseline is the delta record, per runs 145/149).

**No new `SK-*`** (P5/D5): additive content within the existing `SK-SOLVE-001/002/003` shape; no
decision changes. **KPI (GLOBAL-025):** advances **onboarding/distribution** — widens the organic
capture surface at the search moment; **degrades none** (content-only, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
