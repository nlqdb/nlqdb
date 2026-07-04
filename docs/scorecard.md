# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — [`/weekly`](../.claude/commands/weekly.md)
sets it; until then the daily lever targets the worst **agent-movable**
number below.)*

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable inputs. Today's
(07-04, run 4) lever: **docs-ambiguity (row #17), 34 → 30** — a first-class
agent-movable clarity lever (research → resolve → document → mark). The engine
lever already moved this cycle — **`SK-LLM-043`** (the projection directive, row
#8) landed via **#605** — and distribution had been pulled 3 of the last 5
merged PRs with tiny measured yield (row #7 = 3 referrals), so the anti-rut
spirit steered to a different lever. Resolved 4 already-decided-in-substance open
questions (one, the `@cloudflare/playwright` walker question, grounded by fresh
P2 research: it went GA on the Workers **Paid** plan, but the §1.1 stranger-IP
rule still bars a Worker being the stranger ⇒ keep `bun` + Chromium). Step-3
artifact: a new `/solve` surface — `count-consecutive-days-streak-in-sql`
(P3-analyst gaps-and-islands / streak wedge, the classic date-minus-row-number
run-length pattern LLMs routinely botch) ⇒ **row #6 76 → 77**. **BIRD 0.512
stays below its ≥ 0.60 Phase 2 floor** — engine work ships until cleared
(`SK-QUAL-005`). Phase 2 exit gate: **1/9 criteria pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-03 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 93 / 118 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; still zero `/v1/ask` since the 07-02 deploy (latest `last_queried_at` = 07-02 09:25 UTC, 28h+ quiet) — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **77** (`/vs` 31 + `/solve` 33 + `/blog` 13) — was 76 | leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. This run's step-3 artifact (not the lever): +1 `/solve` (`count-consecutive-days-streak-in-sql`, P3-analyst gaps-and-islands / streak wedge — the date-minus-row-number run-length pattern, distinct from the histogram/window/aggregate/set-difference cluster; blog/queue occupied by open PR #605, so a `/solve` surface avoids the conflict) |
| 7 | Surface yield | posts 11; 7d external referrals = 3 (`www.google.com` + `aisearchindex.space` + `bing.com`, 1 pageload each) | CF `refererHost` — measured every run |
| | **Engine** — BIRD 07-03 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.512** (256/500, 07-03 — first completed 500q canonical since 06-19; Δ −0.8 pp vs 0.520, McNemar p=0.36 statistically flat, 0 flagged regressions; [run 28640034273](https://github.com/nlqdb/nlqdb/actions/runs/28640034273)) | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Resume loop closed (4 checkpointed windows), baseline re-seeded 07-03; pin-branch delete blocked by session push scope — any session with branch-delete rights can drop `eval/bird-resume-0e67e64`. **07-04 run 3: `SK-LLM-043` projection directive shipped** — de-concat ceiling on the real DBs flips 3/7 concat-mismatches (EX 0.512→0.518), 0/256 matches at risk; live EX re-measures on the next canonical CI run |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | **BIRD agentic-frontier: 19.3 pts** (free 47.33% → agentic-frontier 66.67%, 150-q smoke seed 20260607, 07-03; single-frontier lane 20.0 pts). persona-bench 0.00 pts (07-02) | **First clean agentic smoke since the `SK-QUAL-021` hang fix (#596)** — ran the full 150-q slice end-to-end in ~15 min, status `completed`, not resumable (windows 1–4 earlier 07-03 all ceiling-cancelled at 44 min on the runaway-SQL freeze the fix removed). Lanes: free 71/150, frontier 101/150, agentic-frontier 100/150 (both frontier lanes carry 7 `openrouter:parse` no_sql ⇒ their ceiling is higher). Smoke — no baseline touch; BIRD canonical stays 0.512 (row #8). [run 28685576019](https://github.com/nlqdb/nlqdb/actions/runs/28685576019). **07-04: the 7 `openrouter:parse` root cause fixed at the source (`SK-LLM-042`)** — OpenRouter's 200-body error envelope was misclassified as engine `parse`; now `rate_limited` (capacity pause) / `provider_error` (retryable, tail-retry-covered). Deterministic proof shipped (unit tests); frontier-lane ceiling re-measures on the next agentic-frontier smoke window |
| | **Ops** — 7d, CF Workers analytics (fresh 07-03 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 1,949 / 0 (0.00%) | mcp-server 816 req / 0 err; events-worker 2 req |
| 13 | nlqdb-api wall-time p50 / p95 | 1.0 ms / 876 ms | mcp-server p95 331.8 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.64** (natural 1-day decay from 0.75) — sdk ✅ 07-02 · mcp ✅ 07-02 · examples ✅ 07-02 · opencheck ❌ (last ✅ 06-12 ⇒ freshness 0) | opencheck failed twice 07-02 on OpenRouter free-tier 429 (driver LLM throttled — infra, not product); its driver shares free-LLM capacity with the eval lanes (BIRD burned it again 07-03) — dispatch opencheck on an eval-free day |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.512, fresh 07-03); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**measured 07-03, row #11: Δ 19.3 pp ✓ ≤ 25, but agentic 0.667 ✗ < 0.80 — 7 `openrouter:parse` no_sql suppress the frontier lanes; criterion still fails on the absolute floor**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: **the 7 `openrouter:parse` root cause is now fixed at the source (`SK-LLM-042`, 07-04)** — re-measure agentic-frontier vs the 0.80 floor on the next smoke window; first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **30** (07-04 run 4, was 34; 165 total bullets, 135 resolved/parked/decided) | target ↓ 0. **This run's lever: −4** — `stranger-test` `@cloudflare/playwright` (Resolved via P2: GA on Workers **Paid**, but §1.1 stranger-IP rule bars a Worker-as-stranger ⇒ keep `bun`+Chromium), `framework-wrappers` `@nlqdb/qwik` (Deferred to Phase 2 P2; dropped a dead `/tmp/…` research-path ref), `sdk-swift` Kotlin/Flutter (Deferred to Phase 2), `quality-eval` canonical-raw-EX (Resolved — a SoT pointer, not a question). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts to 53). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved/delete |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-04 run-4 sweep: 97 pages, 2,272 internal links — new `/solve` streak page included) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (per-agent RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/ (run 53 — anchors `/vs/pinecone`)
- https://nlqdb.com/blog/store-form-submissions-without-a-backend/ (run 106 — anchors `/solve/store-form-submissions-without-backend`)
- https://nlqdb.com/blog/not-in-subquery-null-trap/ (run 130 — anchors `/solve/find-rows-with-no-match-in-another-table`)
- https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/ (run 20 — anchors `/vs/zep`)
- https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/ (run 2 — engine lesson)
- https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/ (run 102 — anchors `/vs/hex`)
- https://nlqdb.com/blog/text-to-sql-accuracy-schemas-your-users-never-build/ (run 55 — engine lesson, persona-bench/SK-QUAL-018)
- https://nlqdb.com/blog/ai-internal-tool-builder-faster/ (run 67 — anchors `/vs/retool`)
- https://nlqdb.com/blog/offline-llm-eval-rate-limits/ (run 68 — engine lesson, SK-QUAL-013 capacity honesty)
- https://nlqdb.com/blog/sitemap-advertising-redirects/ (run 69 — engine lesson, trailing-slash canonical/sitemap hygiene)
- https://nlqdb.com/blog/text-to-sql-build-vs-buy/ (run 109 — anchors `/solve/add-ask-your-data-feature-without-building-text-to-sql`)
- https://nlqdb.com/blog/find-duplicate-rows-you-re-google-every-time/ (run 119 — anchors `/solve/find-duplicate-rows-in-my-data`)
- https://nlqdb.com/blog/your-bi-tool-got-acquired-data-layer/ (run 110 — anchors `/vs/mode`)

## Last change

**2026-07-04 (run 4)** — lever: **docs-ambiguity (row #17), 34 → 30** (−4). The
engine lever already moved this cycle — **`SK-LLM-043`** (the projection
directive, row #8) landed via **#605** — and distribution had been pulled 3 of
the last 5 merged PRs (#604/#602/#599) with a measured yield of only 3 referrals
(row #7) — so the anti-rut spirit steered to a different, guaranteed-delta lever.
Resolved 4 open-question bullets already decided in substance (bookkeeping-fix
per the #601 precedent, plus one genuine P2 resolution): `stranger-test`
`@cloudflare/playwright` (**Resolved via web research** — CF shipped it GA on the
Workers **Paid** plan synced to Playwright v1.55, but the §1.1 stranger-IP rule
still bars a Worker being the stranger and it's Paid-plan-gated vs `GLOBAL-013`,
so keep the `bun`+Chromium walker); `framework-wrappers` `@nlqdb/qwik`
(**Deferred** to Phase 2 P2 — also dropped a dead `/tmp/…` research-path
reference); `sdk-swift` Kotlin/Flutter (**Deferred** to Phase 2); `quality-eval`
canonical-raw-EX (**Resolved** — it's a single-source-of-truth pointer, not an
open question). Step-3 artifact: a new `/solve` page —
`count-consecutive-days-streak-in-sql`, the P3-analyst gaps-and-islands / streak
wedge (the date-minus-`ROW_NUMBER()` island-key run-length pattern LLMs routinely
botch, distinct from the shipped histogram / window / aggregate / set-difference
cluster) ⇒ **row #6 76 → 77** (`/solve` 32 → 33). Row #18 re-swept **0 dead / 0
redirecting** across 97 pages / 2,272 internal links (was 96 / 2,247). Gates
green: `@nlqdb/web` test 220/220, astro-check 0 errors, biome lint clean,
`grep -rn '^### GLOBAL-' docs/features/` empty. **KPI:** GLOBAL-025
onboarding/UX — docs-clarity −4 ambiguous bullets + 1 AEO-shaped indexable
surface, auto-listed in `llms.txt` + sitemap. None degraded — docs + one typed
`SolveEntry`; no code paths touched, engine/funnel/ops numbers carry from the
< 24 h-old 07-03 pull.
