# Scorecard — current state

Point-in-time **progress tracker**, regenerated each
[`/daily`](../.claude/commands/daily.md) run. **Current state only — no changelog
accretes here** (≤5 KB cap; reset 2026-06-28). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — founder picks at the weekly session; until
then the daily lever targets the worst **agent-movable** number below.)*

**Worst number today:** real strangers reaching a first answer = **0** — a
*lagging* metric, moved only by compounding surfaces over time, not by any single
run. The daily **lever** therefore targets its agent-movable input: **indexable
distribution surfaces** (`/vs` + `/solve` + `llms.txt`, row #14), shipped every
run. The worst *engine* number — **Spider 0.1852 vs 0.75** (bottleneck: SQL
reasoning) — is real but dispatch-gated: reasoning levers (§4 #1 retrieval, #3
self-consistency) **built end-to-end**; directive levers (T13–T22) + offline
retrieval (row #8, 23/23) **saturated**; next engine gain needs the gated EX dispatch.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (06-25 pull; carried — analytics/D1 re-pull blocked this run) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 / 139 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is rows #2/#3 |
| 2 | Waitlist rows, real | 1 of 81 | 80 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev |
| 4 | Anon DBs with a first answer | 130 of 130 | every DB has a first query; genuine-stranger subset still ~0 (rows #2/#3) |
| 14 | Indexable distribution surfaces | 61 (`/vs` 31 + `/solve` 30) | **agent-movable daily lever** — leading input to rows #1–#4; `llms.txt` auto-aggregates both. Grow every run |
| | **Engine** — BIRD 06-19 (**12d, stale**) · Spider 06-17 (**14d, stale**) · persona-bench 06-22 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`). **Dispatch gated** — MCP `workflow_dispatch` 403 + `GH_TOKEN_WORKFLOW` PAT proxy-blocked (run 126); see Last change |
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

**2026-07-01 (surface +1)** — shipped `/solve/find-rows-with-no-match-in-another-table`
(P3 analyst, anti-join / "who's missing" wedge). Row #14 **60 → 61** (`/solve`
29 → 30); `llms.txt` + sitemap auto-aggregate it. Distinct SQL primitive from the
window-function/aggregate cluster — a set difference across two tables — with the
`NOT IN`-with-NULLs trap as the honest hook. 176 web tests + astro-check (0 errors)
green. Prior run repointed the daily lever at this agent-movable surfaces count
(row #14) rather than the lagging strangers metric. **KPI:** GLOBAL-025
onboarding/UX; none degraded.
