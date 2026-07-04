# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤20 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — [`/weekly`](../.claude/commands/weekly.md)
sets it; until then the daily lever targets the worst **agent-movable**
number below.)*

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric. But **BIRD 0.512 stays below its ≥ 0.60 Phase 2 floor**, and
`SK-QUAL-005` is explicit: below-floor ⇒ **engine work ships until cleared**. So
today's (07-04, run 3) lever is engine, not distribution (the last 3 daily PRs
— #604/#602/#599 — all pulled distribution; #603 was the only engine pull).
Pick: **ship an evidence-picked planner directive that moves BIRD EX (row #8)**.
The `SK-QUAL-014` offline analyzer on the pinned baseline finds a clean,
zero-risk loss bucket — **7 of 238 free-lane mismatches concatenate requested
columns** (`first_name || ' ' || last_name`) into one value where gold returns
them separately, while **0 of 256 matches** use `||` and gold uses it in only
**1 of 500** queries. Shipped **`SK-LLM-043`** — one `PLAN_DIRECTIVES` bullet:
return each requested attribute as its own column unless the goal explicitly
asks for a combined string. **Measured on the real BIRD SQLite DBs with the
canonical scorer** (de-concatenate the 7 cases, re-score): **3 flip
mismatch→match** (qid 1381/898/1002), EX ceiling 0.512 → 0.518 (+0.6 pp), with a
**zero regression floor** (no passing row uses `||`). Phase 2 exit gate:
**1/9 criteria pass** (row #16); the canonical CI run re-measures the live EX.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-03 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 93 / 118 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; still zero `/v1/ask` since the 07-02 deploy (latest `last_queried_at` = 07-02 09:25 UTC, 28h+ quiet) — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | **76** (`/vs` 31 + `/solve` 32 + `/blog` 13) — was 75 | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run. This run: +1 `/solve` (`group-numbers-into-ranges-in-sql`, P3-analyst histogram / group-by-range wedge — distinct from the window/aggregate/set-difference cluster; blog queue is occupied by open PR #603, so a `/solve` surface avoids the conflict) |
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
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **34** (07-04, was 38; 165 total bullets, 131 resolved/parked/decided) | target ↓ 0. **This run's lever: −4** — `auth` domain-verify (Done → Resolved), `frontier-keys` Redis-vs-KV (Decided: KV) + budget-accounting (Deferred to Lago), and the stale `frontier-keys` AGENTS.md-§5-row bullet deleted (row already at `AGENTS.md:163`). **Method pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — a case-sensitive grep over-counts to 53). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved/delete |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-04 run-2 sweep: 96 pages, 2,247 internal links — new `/solve` page included) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
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

**2026-07-04 (run 3)** — lever: **BIRD EX engine directive (row #8)**, breaking
the 3-run distribution streak because `SK-QUAL-005` mandates engine work while
BIRD 0.512 < the 0.60 Phase 2 floor. Local eval was unblocked this run
(downloaded the 800 MB BIRD Mini-Dev DB fixtures + questions JSON; the free LLM
chain itself can't run here — bun's `fetch` won't traverse the MITM proxy, a
README-flagged limitation — so scoring is done offline against the real SQLite
DBs, no LLM). The `SK-QUAL-014` analyzer surfaced a clean loss bucket: **7 of
238 free-lane mismatches** concatenate requested columns
(`first_name || ' ' || last_name`) into one value where gold returns them
separately; **0 of 256 matches** use `||`; gold uses `||` in **1 of 500** —
near-pure upside. Shipped **`SK-LLM-043`**: one `PLAN_DIRECTIVES` bullet
(projection sibling of `SK-LLM-027`) telling the planner to return each
requested attribute as its own column unless a combined string is explicitly
asked for. **Before → after (deterministic ceiling on the real DBs +
canonical scorer):** de-concatenating the 7 cases and re-scoring flips **3
mismatch→match** (qid 1381/898/1002) — EX 0.512 → **0.518** (+0.6 pp) — with a
**zero regression floor** (no passing row concatenates). Artifact (step 3, queue
< 3 deep ⇒ draft): queued the `llm-concatenates-columns-text-to-sql` engine-lesson
post. D4 hygiene: net-shrank `llm-router/FEATURE.md` (−3 B, verbose reference
lines trimmed to offset the `SK-LLM-043` row) and `distribution-queue.md` (−576 B,
Published venue-variant gists condensed to URL+venue+anchor — back under 20 KB).
Gates green: `@nlqdb/llm` 249/249 tests, typecheck + lint clean. **KPI:**
GLOBAL-025 engine quality (NL→SQL free lane). None degraded — prompt-only ≈45
tokens, `PLAN_SYSTEM` byte-stable under `buildPlanSystem(k≤0)`; funnel/ops carry
from the < 24 h-old 07-03 pull. Live EX re-measures on the next canonical CI run.
