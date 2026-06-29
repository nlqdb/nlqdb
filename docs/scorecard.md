# Scorecard — current state

Point-in-time **progress tracker**, regenerated each
[`/daily`](../.claude/commands/daily.md) run. **Current state only — no changelog
accretes here** (that bloated this file 3× past its ≤5 KB cap; reset 2026-06-28).
History: `git log` + `progress/quality-score-verification-log.md` (engine) + the
WS-*/E-* worksheets. Pivot rows mirror `agent-memory-pivot/worksheets/INDEX.md`.

**Weekly focus number:** *(none set — founder picks at the weekly session; until
then the daily lever targets the worst number below.)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution). Product is open, so the engine-side worst — **Spider
0.1852 vs 0.75** — owns it. Bottleneck = **SQL reasoning**. Directive levers
(T13–T22) **saturated**; path to target is the §4 reasoning levers (#1 DAIL-SQL
retrieval, #3 self-consistency) — both **built end-to-end**, both dispatch-gated.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (06-25 pull; carried — analytics/D1 re-pull blocked this run) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 / 139 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is rows #2/#3 |
| 2 | Waitlist rows, real | 1 of 81 | 80 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev |
| 4 | Anon DBs with a first answer | 130 of 130 | every DB has a first query; genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine** — BIRD 06-19 (**9d, stale**) · Spider 06-17 (**11d, stale**) · persona-bench 06-22 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`). **Re-dispatch carries to the cron `/daily` lane** — interactive dispatch 403; bun `fetch` can't tunnel proxy-MITM TLS so local eval is blocked too |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Flat within variance (McNemar p=0.50) — directive levers saturated; reasoning levers (§4 #1/#3) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). **Worst engine number.** Self-consistency (`SK-QUAL-017`) end-to-end bar the CI dispatch input; EX delta on next dispatch |
| 8 | persona-bench free-chain EX | 0.90 (18/20) | full-chain ICP EX (run 58/63). **1.7× BIRD, 4.9× Spider** — the GLOBAL-026 bet. N=20 runs ±1 noisy. Retrieval precision@1 **22/23** (run 100: +group-count-top-n row lands q8); 1 miss q22 needs query-skeleton similarity (dispatch-gated) — selector tweak rejected (run 52), pool-curation lane live |
| 9 | free-vs-frontier delta | null *(secret-blocked)* | `OPENROUTER_FRONTIER_API_KEY` empty in CI (filed in `blocked-by-human.md`); dispatch path proven, delta lands when founder sets the secret |
| | **Ops** — 7d, CF Workers analytics (06-22 pull) | | wall-time, all routes |
| 10 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err |
| 11 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s | p50 trivial routes, p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` |
| 12 | $ spend | ~$0 | free tiers (CF / Neon / LLM chain) |
| | **E2E** — 4 manual `workflow_dispatch` suites (06-25 pull) | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d since last green |
| 13 | E2E manual-suite freshness | 0.00 | target > 0. 3/4 latest-green (sdk/examples/opencheck ✅, mcp ❌ 06-24) but all last-green ≥ 7d ⇒ every freshness 0. Re-dispatch the 4 `e2e-*.yml` to lift (dispatch-gated) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 10 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md`. `/vs`: zep·letta·langmem·pinecone·chroma·weaviate·qdrant·cognee·milvus (+mem0/zep/letta matrix) |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03 (RLS scoping, security-critical) · E-04 (TTL sweep) · E-05 (hybrid recall) · E-06 (authed on-ramp, redirected) · E-07 (ClickHouse routing) — all Neon/infra-gated |

## Shipped distribution (live URLs)

From `research/distribution-queue.md` — *(none live yet; drafts await review.)*

## Last change

**2026-06-29 (run 104)** — hard numbers gated this run (eval dispatch 403,
funnel re-pull network-blocked, retrieval saturated 22/23, comparison-pages
owned by open PR #534) → per daily rule 2, a measured **onboarding/UX hygiene**
lever: the documented `/solve` "≤25 words per howNlqdbAnswers bullet" AEO rule
lived only in a code comment and had silently drifted — **25 of ~50 bullets over
budget**. Tightened all 25 to ≤25w (facts preserved) + added a
CI guard (`solve.test.ts`) naming offenders on failure — the silent-drift fix
#534 shipped for `/vs` SK-CMP-001, in a non-conflicting file. **Over-budget
`/solve` bullets 25 → 0**; apps/web 175/175 green, check + lint clean. **KPI:**
GLOBAL-025 onboarding/UX; none degraded. *(Prior run 103 — the same silent-drift
fix for `/vs` SK-CMP-001 "≤16 words per comparison bullet": added a
`competitors.test.ts` guard naming offenders + tightened the Outerbase entry's 7
over-budget bullets; **over-budget `/vs` bullets 7 → 0**, integrity tests 13 → 14.)*
