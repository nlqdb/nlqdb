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

**Worst number today (run 155, 2026-07-29):** **CI red on `main` (rule 6)** — the
direct-to-`main` domain-move commit `6843f0d` ("salfati.group → nlqdb.com") mechanically
rewrote two admin-gate reject-case assertions from `other@salfati.group` to
`other@nlqdb.com`, which the `ADMIN_DOMAINS={nlqdb.com}` rule now *admits* → `expect(...).toBe(false)`
fails in both `apps/api/src/admin/gate.test.ts` and `apps/web/src/lib/admin-gate.test.ts`.
CI job has been **failure on `6843f0d` since 14:22Z** ([push runs](https://github.com/nlqdb/nlqdb/actions));
all six `deploy-*` are green on the same SHA (deploys don't run tests ⇒ production is fine, no
stale build). Per **rule 6 this red main IS the run** and outranks the weekly-focus dogfood
gate. Fix restores the pre-move security-boundary meaning: the **retired** `@salfati.group`
domain must no longer admit anyone (2 assertion lines).
**Overlap note (step 0).** Open PR **#876** bundles this same test repair with dogfood D-01
tracking + a new skill rule + a new test — a larger review surface. Rule 6 (non-negotiable,
"outranks every other lever") governs: this run ships a **minimal, decoupled, immediately-
mergeable** fix so `main` gets a clean shot at green regardless of #876's review latency;
whichever lands first, the other drops its duplicate hunk.
**Weekly-focus gate (unchanged):** `SK-PIVOT-016` dogfood gate **0/5** — D-01 in flight on
#876; D-02/D-04+ chain off it. Not pulled this run (red main pre-empts).
**Top `blocked-by-human` bullet:** fire the Show HN launch sequence (⏱ ~30 min,
**idle 46 days since 06-13**) — the only bullet that can move real strangers off 0, still
condition-gated on the `SK-PIVOT-016` gate (**0/5**). Every criterion is agent-movable; the
prod prerequisite is now clear, so the gate is the weekly-focus lane to drive as D-01 merges.
**Dark (rule 8, reported not pulled):** engine **#8 BIRD 0.5382** / **#9 Spider
0.2222** (Spider **10 d** stale, > 7 d alert — resume-dispatch deferred: async multi-window,
a 07-27 partial checkpoint exists on `d961475`, `main` has since moved); rows
**#4/#5/#16**'s stranger-dependent criteria (N = 0 until the launch bullet fires); row
**#15**'s opencheck arm (free-lane saturation, remedy costs money ⇒ rule 4).

**Rule 6 — was RED, fixed this run.** On `main@6843f0d` the CI job is **failure** (2 admin-gate
assertions; see worst-number above), though `typecheck` + `lint` are green and all six
`deploy-*` are green (production unaffected). After this run's 2-line assertion fix, on the
branch head: `bun install` then `bun run typecheck` (all workspaces EXIT=0) · `bun run lint`
EXIT=0 (41 warnings, 0 errors — pre-existing) · `bun run test` **overall EXIT=0** (api vitest
1014 pass/15 skip; full workspace green). Touched-scope: `apps/api/src/admin/gate.test.ts`
4 pass, `apps/web/src/lib/admin-gate.test.ts` 2 pass.
Open PRs (7): **#876** (dogfood D-01 + this same domain-move test repair — overlap, see above),
**#875** (reach R-09), **#874** (Glama), **#873** (web topnav keys link), **#864** (changesets),
draft **#719** (oldest, **12 days**). This run's files (the two `*gate*.test.ts`) overlap only
#876, addressed by the decoupling note above.

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

- **This run (155):** no new blog post — the lever was the rule-6 red-main CI fix (not a blog
  surface); distribution queue at 2 (< 3, no forced publish). Dev.to drip **fired** (step 3.3):
  syndicated run 24's post → https://dev.to/omer_hochman/your-database-scales-to-zero-your-retry-loop-doesnt-know-that-373e
  (queue line's dev.to venue dropped, Reddit/lobste.rs kept). Last canonical blog post remains
  run 151's `/blog/guard-advertised-capabilities-against-code/`.

## Last change

**2026-07-29 (run 155)** — **Number moved: CI on `main` red → green (rule 6)**. The
direct-to-`main` domain-move commit `6843f0d` broke the CI test job: its mechanical
`salfati.group → nlqdb.com` replace rewrote the admin-gate *reject-case* assertions from
`other@salfati.group` to `other@nlqdb.com`, but `ADMIN_DOMAINS={nlqdb.com}` now admits that
address — so `expect(isAdminEmail("other@nlqdb.com")).toBe(false)` fails in both the api and
web gate tests. CI red since 14:22Z; deploys green (they run no tests).

**The fix.** Restore the assertions' original *meaning* — after the move, the security
boundary they pin is that the **retired** `@salfati.group` domain no longer admits anyone.
So each reject-case reverts to `expect(isAdminEmail("other@salfati.group")).toBe(false)`
(the source `admin-gate.ts`/`gate.ts` allowlist is correct and untouched). Two assertion
lines, no source change.

**Measure → change → re-measure.** Before (branch = `main@6843f0d`): api `gate.test.ts` +
web `admin-gate.test.ts` fail (3 fails / `bun run test` red; CI job failure on GitHub).
After: `bun install` → `typecheck` all EXIT=0 · `lint` EXIT=0 · `bun run test` **overall
EXIT=0** (api vitest 1014 pass; full workspace green); the two gate suites 4 + 2 pass.

**Overlap (step 0 vs rule 6).** Open PR #876 bundles this same repair with dogfood D-01
tracking. Rule 6 is non-negotiable and "outranks every other lever"; this run ships the
minimal decoupled fix so `main` recovers regardless of #876's larger review surface —
whichever merges first, the other drops the duplicate test hunk.

**No new `SK-*`** (P5/D5): a mechanical-replace regression fix; no decision changes.
**KPI (GLOBAL-025):** advances **engine quality + onboarding** — unblocks CI for every
open PR and the admin security-gate tests assert the boundary they mean to; **degrades none**.

_(Single-entry by design — per-run history lives in `git log` +
`progress/quality-score-verification-log.md`.)_
