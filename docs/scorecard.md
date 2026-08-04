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

**Worst number today (run 163, 2026-08-03):** the **weekly-focus `SK-PIVOT-016` dogfood gate 0/5**
stays the worst number — but this run **could not pull it**: it is fully human/founder-blocked.
Criteria 1/2/3/5 gate on **D-04** (prod `NLQDB_MEMORY_DB` + the queue-#2 `NLQDB_API_KEY` secret);
criterion **4** (ops temporal 0/4) has **no GLOBAL-037-compliant agent-movable lever** — re-verified
this run by reading the preset: `facts.kind`/`episodes.role` are free `TEXT` and the value vocabulary
is **pack-defined, not preset-defined** (E-09 §rejected-shortcuts), so a `CHECK`/`ENUM` on the
`agent_memory_v1` preset would wrongly reject a stranger's free-text `kind` and break the
`SK-PIVOT-007` public contract — E-09 path-1 is a preset-schema **design decision**, not a daily
patch, exactly as scoped (PR #883). So per step-2 priority order this run pulled the **acquisition-lane
worst number: distribution row #7.** Fresh GSC (28d, 07-04→08-01): **8 clicks / 582 impr / pos 19.2**.
Strengthen-next **#1 = `/solve/running-total-cumulative-sum-in-sql/` — 117 impr / pos 36.5 / 0 clicks**,
by far the biggest page still off page 1. It was **content-strengthened in run 157 and is still pos 36.5**
(was 114 / 36.4); run 159's #2 `find-rows-with-no-match` is likewise flat (43 / 17.3 vs 41 / 16.7).
**Two content levers moved position ~0 ⇒ the bottleneck on deep-ranked pages is internal authority,
not on-page content.** This run pulled the untried on-site lever: extended #888's `/solve ↔ /solve`
`related` mesh to the **SQL-technique cluster**, funneling inbound links into `running-total` from all
five window/time-series siblings — incl. the **page-1 authority donor** `count-rows-per-day…` (pos 8.3).
See Last change.
**Weekly-focus gate (don't overwrite mid-week):** dogfood **0/5**, unchanged — no agent-movable lever
this run (D-04 secret-blocked; criterion 4 GLOBAL-037-blocked).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 51 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate. #2 = set `NLQDB_API_KEY` (⏱ ~2 min, unblocks D-02's sync →
gate criterion 1). Queue **depth 6**; head age 51 d is the real cycle time.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider 0.2222** (**15 d**
stale, resume deferred: async multi-window, `main` moved since the 07-27 checkpoint); rows
**#4/#5/#16** stranger-dependent (N = 0 until launch); row **#15** opencheck (free-lane saturation,
remedy costs money ⇒ rule 4); dogfood gate criteria (D-04 secret-blocked, E-09 GLOBAL-037-blocked).

**Rule 6 — GREEN.** `main@88e166d` CI all **success** (the lone `action_required` is #864's Security
gate awaiting approval, not a failure); recent merges docs/tool-only ⇒ no deploy-triggering change
since run 157's verified-green deploy. Branch head: `bun install` clean · `biome check` clean on the
two changed files · `bun test solve.test.ts` **18 pass / 0 fail** (+1 authority-funnel guard).
Open PRs (4): **#894** (reach R-05 Cline park), **#885** (agent-memory UX docs), **#864** (changesets),
draft **#719** (oldest, **17 days**).
This run's files (`apps/web/src/data/solve.ts` + `solve.test.ts`) overlap **none** — #888's `/solve`
mesh work is **merged**, and this extends that shipped `related` field to a different, non-overlapping
cluster.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (GSC pulled **live this run**; RUM carried from run 159's live 08-02 pull — same day. Users/DBs carried from 07-27 remote-D1, no channel newly live) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF RUM) | **181 pl / 179 vis** raw, **real-browser floor 40 pl / 39 vis** (07-26→08-02, carried from run 159; not re-pulled — this run worked GSC/distribution). Real-browser landings led by `nlqdb.com/` (7), `/agents/` (6), `docs…/agent-memory/` (4) | cut rule: `bot=1` or `userAgentBrowser ∈ {Unknown, ChromeHeadless}`, every removed row listed ⇒ real-browser is a floor. Read at **7d** (28d comes back sampled at interval 10) |
| 2 | Registered users, real strangers | 0 | 9 total = 4 founder/company + 5 test/dev (`*@example.com`, `*@preview.dev`) — live remote-D1 07-27, roster byte-identical a 4th run; no channel newly live to produce a signal |
| 3 | DBs total | **254** (07-27 live remote-D1, flat across runs 143–147; synthetic — walker/preview churn) | stranger subset ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | **stranger-only N = 0 → not measurable** (`SK-ONBOARD-007`). Re-verified live 07-27: `databases.source_json is not null` = **0** | target ≥ 95%. Instruments live: TTFV + chips + drop-off funnel |
| 5 | Session retention (≥ 2 queries) | 1 DB with `first10_asks ≥ 2` (07-12; founder-owned) | share with ≥ 2 asks |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **105** content pages (`/solve` 37 + `/vs` 31 + `/blog` 37); **117** sitemap URLs, **127** built pages. Queue **2** (< the 3-deep forced-publish threshold — no publish this run); drafting skipped (optional, P5) | leading input to rows #1–#3; `rss.xml` + `llms.txt` + sitemap auto-aggregate |
| 7 | Surface yield | posts **37** (no change). GSC live this run (28d, 07-04→08-01): **8 clicks / 582 impr / pos 19.2**; clicks concentrated — **`/security/hall-of-fame/` 4 of 8** (14 impr, pos 13.6). **Strengthen-next #1 = `/solve/running-total-cumulative-sum-in-sql/` — 117 impr / pos 36.5 / 0 clicks — this run's lever target** (biggest page off page 1; content-strengthened run 157, **still pos 36.5** ⇒ content isn't the bottleneck; pulled the internal-authority lever instead — see Last change). #2 = `/solve/find-rows-with-no-match-in-another-table/` — 43 / 17.3 (run 159's target, also flat). Next: `/vs/` 26 / 14.8 · `/blog/` 20 / 24.0 · `/vs/metabase/` 20 / 12.9. Index status: **3/6 wedge pages indexed** (`/agents/` crawled 08-02); `build-vs-buy`/`expire-old` still never-crawled (#888's mesh links land, verify R-08 08-22) | `scripts/gsc-pull.ts` + `scripts/rum-pull.ts`. Total-impression breadth is the bottleneck, not per-page CTR at N ≤ 12 impr (noise) |
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
| 15 | E2E manual-suite freshness | **0.420** (recomputed 07-28; was 0.492 — **pure time-decay, no suite changed state**). Per suite `pass × freshness`: **mcp 0.576** (✅ 07-25) · **sdk 0.553** (✅ 07-24) · **examples 0.553** (✅ 07-24) · **opencheck 0** (latest ❌ 07-24; last success 07-17 ⇒ 11 d, freshness floored — the documented NVIDIA-free-tier saturation flake, remedy costs money ⇒ rule 4). Purely opencheck-limited; the other three decay ~0.14/day | Never dispatch opencheck alongside another lane consumer. Triage: `e2e-coverage/opencheck-operations.md` |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.5382); agentic-frontier ≥ 0.80 (0.693); TTFV p50 ≤ 60 s (instrumented, awaits strangers); first-10 ≥ 95% (N=0); destructive-op retry (N≈0); MCP in 3+ hosts (0); 1 public agent product (0); 3 non-engineer CSV tests (CSV unshipped) | stranger-dependent criteria measure reality since run 56 removed the 428 wall |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **9** (07-29 pinned grep; elements 2, + 7 features 1 each). Carried this run (no FEATURE.md open-question edited) | target ↓ 0. Method: `- ` bullets under `## Open questions` not matching `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed`. De-prioritised as a default lever (07-11 /weekly) |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting internal + 0 dead cross-app** (last full sweep run 162: 127 pages, 3,268 internal + 15 cross-app links; not re-swept this run — data-only /solve edit adds 5 in-cluster links, all resolve via `solve.test.ts`) | target 0 — `check-links.mjs` + `client-nav-integrity.test.ts`. Standing blind spots: external inbound links to bare paths (≥107 impr), npm entrypoints (#19), `www.` host un-redirected (zone Redirect Rule ⇒ console click), link-less pages |
| | **Product-readiness** — client-blocking gaps (added 07-04) | | |
| 19 | Live-surface claim integrity | **0 ✓** (resolved 07-29): `#826` published `@nlqdb/sdk@0.2.2` + `@nlqdb/mcp@0.1.1`; a clean-dir install resolves `dist/` entrypoints (the `ERR_MODULE_NOT_FOUND` class is gone). `npm view` src-pointing `main` is a cosmetic packument artifact — the installed tarball carries `prepack`'d `dist`. 0-phantom sweeps unchanged | target 0 ✓ |
| 20 | Hosted-premium readiness (§6 build-before-signal) | schema ✅ · BYOLLM lanes ✅ · picker web ✅ (`SK-PREMIUM-013`) + parity ✅ (`SK-PREMIUM-014`) · CTA ✅ (`SK-PREMIUM-004`) · premium chain ⬜ (`SK-LLM-017`, flag-dark) · spend-cap UI ⬜ (Lago-parked) | per [`phase-plan.md §6`](phase-plan.md) + `GLOBAL-026` the paid plan is built before the signal fires |
| 21 | Stranger-walker pass rate (canonical flows, GLOBAL-032) | **0 failed / 9 blocked** — carried from the 07-26 live walk; the scheduled CI walk [30194859852](https://github.com/nlqdb/nlqdb/actions/runs/30194859852) (07-26 08:34Z) concluded success. **Not re-walkable from a `/daily` container**, a new standing constraint: `@playwright/test` pins `~1.60.0`, which wants Chromium **1223**; the image ships **1194**, so the walker aborts with `Executable doesn't exist`. CI-only until they agree | target **0 `failed`** ✅; `blocked` reported beside it, never folded in. All walks stop at the 428 `challenge_required` (Turnstile declining a datacenter IP by design, `SK-ANON-012`), so steps past the ask are **observed, not proven** |
| | **Acquisition** — channel ledger + attribution ([GLOBAL-038](decisions/GLOBAL-038-gtm-pmf-instrumentation.md), `SK-GTM-007`) | | ledger: [`research/acquisition-channels.md`](research/acquisition-channels.md) |
| 22 | Channels live with attributable yield | **4 live** — organic search + dev.to + npm + GitHub (per-bucket split lives only in the ledger). npm attribution now **reaches the registry for 2 of 3 packages**: `@nlqdb/sdk@0.2.2` (`?utm_source=npm`) and `@nlqdb/mcp@0.1.1` (`.../agents/?utm_source=npm`) both verified live this cycle; **`@nlqdb/cli@0.1.0` is the laggard — still an untagged `https://nlqdb.com`**, so this run queued its republish changeset (`@nlqdb/cli` patch) to close the last third. MCP official registry published 07-22 (`com.nlqdb/nlqdb`); Glama crawl-listed; Smithery 0 / PulseMCP 0. First-touch attribution live since 07-19 on both create arms; `source_json` non-null **0**, for want of strangers, not instrument | **weekly focus: → ≥ 5 live.** Yield from `/app/admin` + `scripts/rum-pull.ts`, never estimated. Growth comes only from not-yet-live channels (R-05 registries, human-norm venues) |
| | **Human queue** — the one non-automatable actor | **depth 6**; head is the Show HN launch, oldest bullet **51 days** (`SK-PIVOT-016` gate **0/5**); #2 set `NLQDB_API_KEY` secret (unblocks D-02 sync), #3 Glama badge, #4 community-plugin-directory submit, #5 connector directory (money-gated), #6 skillsclaude.org paste | [`blocked-by-human.md`](blocked-by-human.md). Open PRs: 4, oldest 17 days (draft #719) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/27 + 12 memory `/vs` pages | mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; rest Neon/infra-gated |
| | Dogfood track D-* (`SK-PIVOT-016` gate, **weekly focus**) | **2/7** (D-03 ✅, D-02 🟢 code-complete this run) — gate **0/5** (criterion 4: temporal 2/7 = synthetic 2/3 + ops 0/4; scoped as E-09 in #879) | mirrors [`dogfood/INDEX.md`](features/agent-memory-pivot/worksheets/dogfood/INDEX.md). **D-02 🟢** convergent sync + `memory-sync.yml` (dark until secret + D-04); D-07 ⛔ on D-04. INDEX tick deferred to PR #885 |
| | Memory-quality eval (`SK-QUAL-023`) | **27-q free-chain EX 59.26% (16/27)** — run [30413719690](https://github.com/nlqdb/nlqdb/actions/runs/30413719690) 2026-07-29, `main@5cc4bd1`, `resumable:false`; p50 1074 ms / p95 4406 ms. **First dispatch over the full set (15 synthetic + 12 repo-ops docs→memory questions) — NOT a regression from the old 15-q 93.33% (run 69), a broader+harder denominator that finally measures the workload the launch gate depends on.** Per-axis (free): consolidation 4/5, analytical 4/5, retrieval 3/5, forgetting 3/5, **temporal 2/7 (synthetic 2/3, ops 0/4)** — the weak axis gating `SK-PIVOT-016` criterion 4; each ops-temporal miss's generated SQL is in the run summary (the next engine lever) | 27 gold-verified questions, 5 axes; free-only, no baseline (a measurement, never canonical) |

## Shipped distribution

**37 canonical posts live under `nlqdb.com/blog/`** (`SK-BLOG-001`). The registry is
`apps/web/src/data/blog.ts` — the one place the list exists; venue variants and full
lesson gists stay in `research/distribution-queue.md`.

- **This run (163):** no new blog post — the lever was a distribution structural change (internal-link
  authority mesh), not a blog surface; distribution queue 2 (< 3, no forced publish); drafting skipped
  (P5, optional — the queue already holds a `one-way-internal-links-leak-yield` variant on this theme).
  **Dev.to drip (step 3.3): throttled** (a variant already posted ~8h ago; one/day guard — expected
  no-op). Last canonical blog post remains run 151's
  `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-08-03 (run 163)** — **Number moved: distribution row #7 — inbound internal-authority links to
the #1 "Strengthen next" page `/solve/running-total-cumulative-sum-in-sql/` (117 impr, pos 36.5, the
biggest /solve page off page 1). Before → after: 0 → 5 contextual inbound `related` links** from
indexed, topically-relevant window-function siblings, including the page-1 authority donor
`count-rows-per-day…` (pos 8.3). GLOBAL-025 KPI: **distribution/onboarding on-ramp**.

**Why this lever (yield-informed, rule 7).** The weekly-focus dogfood gate (0/5) is the worst number
but had **no agent-movable lever** this run — D-04's criteria are secret-blocked and criterion 4's
E-09 is GLOBAL-037-blocked (re-verified: the preset's `kind`/`role` are free `TEXT`, vocabulary is
pack-defined, so a preset `CHECK`/`ENUM` would break the `SK-PIVOT-007` free-text contract). Per the
step-2 priority order I dropped to the acquisition lane. Measuring the last two distribution levers'
yield (rule 7): run 157 content-strengthened `running-total` → **still pos 36.5**; run 159's
`find-rows-with-no-match` → **still flat**. Content is not the bottleneck on deep-ranked pages;
**internal authority is** the untried on-site lever. PR #888 built the `/solve ↔ /solve` `related` mesh
but wired it only for the 4-page agent-memory cluster — leaving the highest-impression page starved of
inbound links.

**The change (data-only, existing infra).** Added `related` arrays to the 6-page SQL-window/time-series
cluster in `apps/web/src/data/solve.ts` (`running-total`, `month-over-month-growth`,
`calculate-percentage-of-total`, `count-consecutive-days-streak`, `count-rows-per-day`,
`find-top-n-rows-per-group`), each linking to 3 genuine same-cluster siblings, so `running-total`
receives an inbound contextual link from **all five** siblings. Every link is a real window-function /
time-series relationship (Google devalues topically-forced links). Reuses #888's `related` field +
`relatedSolveEntries` resolver + rendered "Related guides" section — **no new component**. New test guard
pins the invariant so the funnel can't silently regress (target keeps ≥ 2 inbound incl. the page-1 donor).

**Measure → change → re-measure.** Immediate delta: inbound authority links to the target page
**0 → 5**. Leading-indicator re-measure (position/clicks) is a crawl-priority signal, not instant —
verify at the R-08 GSC check (08-22), same as #888's wedge links; if `running-total` is still pos ~36
then, the next move is inbound links from an even stronger indexed page. `biome check` clean ·
`bun test solve.test.ts` **18 pass** (+1 guard).

**Step 3 (artifact):** queue 2 (< 3) ⇒ no forced publish; drafting skipped (P5). **Dev.to drip (3.3):
throttled** (one/day guard, a variant already posted ~8h ago — expected no-op). **No new `SK-*`**
(P5/D5): reuses the existing `SolveEntry.related` capability + `SK-SOLVE-*` conventions, no
cross-cutting rule. **KPI (GLOBAL-025):** advances **distribution/onboarding**; **degrades none**
(data-only additive links + a test, all gates green).

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
