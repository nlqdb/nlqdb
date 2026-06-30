# Scorecard — current state

Point-in-time **progress tracker**, regenerated each
[`/daily`](../.claude/commands/daily.md) run. **Current state only — no changelog
accretes here** (≤5 KB cap; reset 2026-06-28). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — founder picks at the weekly session; until
then the daily lever targets the worst number below.)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution). Product is open, so the engine-side worst — **Spider
0.1852 vs 0.75** — owns it; bottleneck = **SQL reasoning**. Directive levers
(T13–T22) **saturated**; the §4 reasoning levers (#1 DAIL-SQL retrieval, #3
self-consistency) are **built end-to-end** but dispatch-gated. Offline retrieval
probe (row #8) **saturated 23/23** — next engine gain needs the gated EX dispatch.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (06-25 pull; carried — analytics/D1 re-pull blocked this run) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 / 139 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is rows #2/#3 |
| 2 | Waitlist rows, real | 1 of 81 | 80 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev |
| 4 | Anon DBs with a first answer | 130 of 130 | every DB has a first query; genuine-stranger subset still ~0 (rows #2/#3) |
| | **Engine** — BIRD 06-19 (**9d, stale**) · Spider 06-17 (**11d, stale**) · persona-bench 06-22 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`). **Re-dispatch carries to the cron `/daily` lane** — interactive + MCP dispatch 403; local eval proxy-MITM-TLS blocked |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Flat within variance (McNemar p=0.50) — directive levers saturated; reasoning levers (§4 #1/#3) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). **Worst engine number.** Self-consistency (`SK-QUAL-017`) end-to-end bar the CI dispatch; EX delta next dispatch |
| 8 | persona-bench free-chain EX | 0.90 (18/20) | full-chain ICP EX (run 58/63). **1.7× BIRD, 4.9× Spider** — the GLOBAL-026 bet. N=20 ±1 noisy. Retrieval precision@1 **23/23** (run 105) — **offline retrieval saturated**, held-out 17/17. EX delta = gated dispatch |
| 9 | free-vs-frontier delta | null *(secret-blocked)* | `OPENROUTER_FRONTIER_API_KEY` empty in CI (filed in `blocked-by-human.md`); dispatch path proven, delta lands when founder sets the secret |
| | **Ops** — 7d, CF Workers analytics (06-22 pull) | | wall-time, all routes |
| 10 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err |
| 11 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s | p50 trivial routes, p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` |
| 12 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites (06-25 pull) | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d since last green |
| 13 | E2E manual-suite freshness | 0.00 | target > 0. 3/4 latest-green but all last-green ≥ 7d ⇒ freshness 0. Re-dispatch the 4 `e2e-*.yml` to lift (dispatch-gated) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03 (RLS scoping) · E-04 (TTL sweep) · E-05 (hybrid recall) · E-06 (authed on-ramp) · E-07 (ClickHouse routing) — all Neon/infra-gated |

## Shipped distribution (live URLs)

From `research/distribution-queue.md` — *(none live yet; drafts await review.)*

## Last change

**2026-06-30 (run 119)** — hard numbers stay gated (eval dispatch 403; funnel
re-pull network-blocked) and the `/vs` lane was busy (PR #551, run 118
`/vs/langchain-sql-agent`) → a measured **onboarding/UX** lever on the parallel
**`/solve`** lane (no collision): a **data-quality / dedup** pain page,
`find-duplicate-rows-in-my-data` (P3 analyst). Distinct in *query shape* — ask
"which rows are duplicated by email?" in English and nlqdb compiles the
`GROUP BY ... HAVING COUNT(*) > 1`, runs it in Postgres, and shows the SQL so you
can verify the grain. Honest split: it reports duplicates read-only — it doesn't
delete/merge them; matching is exact, not fuzzy. **Solve pages 22 → 23 · P3
coverage 3 → 4**; web-verified demand (r/SQL + SO `sql+duplicates` tag; LearnSQL
GROUP-BY-HAVING guide), 176 web tests green, solve invariants pass, biome clean.
Artifact: a dev.to / r/SQL / r/analytics draft ("the duplicate-rows query you
re-Google every six weeks"). **KPI:** GLOBAL-025 onboarding/UX; none degraded.
*(Prior run 118 — `/vs/langchain-sql-agent`, comparison pages 26 → 27, the first
P4 build-vs-buy page in the §6 OSS text2sql-framework cluster.)*
