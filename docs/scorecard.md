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
pick: **E2E manual-suite freshness (row #15) was 0.00** — all four suites ≥ 7d
stale and one red since 06-24. Vs GLOBAL-025 floors, Spider free (0.1926)
clears ≥ 0.15; **BIRD 0.520 is below its ≥ 0.60 Phase 2 floor** (resume run in
flight, row #8). Phase 2 exit gate measured for the first time: **1/9 criteria
pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-02 pm pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 80 / 102 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; zero `/v1/ask` has bumped the counters since the 07-02 deploy — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | 69 (`/vs` 31 + `/solve` 31 + `/blog` 7) | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run |
| 7 | Surface yield | posts 7; 7d external referrals = 2 (1 `www.google.com` organic + 1 `aisearchindex.space`) | CF `refererHost` — measured every run |
| | **Engine** — BIRD 06-19 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | 0.520 (06-19) — **resume in flight**: [run 28621959802](https://github.com/nlqdb/nlqdb/actions/runs/28621959802) re-dispatched 07-02 on pinned SHA `0e67e64` (branch `eval/bird-resume-0e67e64`), SK-QUAL-013 checkpoint restored | target 0.65 / Phase 2 floor 0.60; next `/daily` reads the report, updates baseline + verification log, deletes the pin branch |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | 0.00 pts (persona-bench 07-02) | frontier key wired; agentic lane (`SK-QUAL-004` headline) unrun |
| | **Ops** — 7d, CF Workers analytics (fresh 07-02 pm pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,086 / 0 (0.00%) | mcp-server 819 req / 0 err; events-worker 1 req |
| 13 | nlqdb-api wall-time p50 / p95 | 0.9 ms / 872 ms | mcp-server p95 331.8 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites (re-run 07-02, the day's lever) | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.75** (was 0.00) — sdk ✅ 07-02 · mcp ✅ 07-02 (fixture fixed after 8d red) · examples ✅ 07-02 · opencheck ⏳ retry [in flight](https://github.com/nlqdb/nlqdb/actions/runs/28622593340) | mcp suite was red since 06-24 on a stale `NlqClient` stub + tool-order pin — fixed this run; opencheck's first try hit an OpenRouter free-tier 429 preflight abort (infra, not product) — retry dispatched 07-02 |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.520); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (lane unrun); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: BIRD floor (row #8 resume), agentic lane dispatch, first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Unresolved open-question bullets, `docs/features/*/FEATURE.md` | 78 across 29 features (07-02; 89 parked per GLOBAL-033, excluded) | target ↓ 0 — **agent-movable**: research (P2/GLOBAL-033) → document (P4) → delete or park; was 88 on 07-02 am (#588 resolved 10) |
| 18 | Dead links, deployed surfaces | 4 found + fixed 07-02 (PR #581); full sweep unmeasured | target 0 — no automated sweep exists yet; **building the built-output href sweep is a lever** |
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

## Last change

**2026-07-02 pm (2nd run)** — lever: **E2E manual-suite freshness 0.00 → 0.75**
(row #15): all four suites re-dispatched; e2e-mcp was red since 06-24 on a
stale `NlqClient` stub (missing `databases.connect` + BYOLLM verbs) and a
tool-order pin missing `nlqdb_connect_database` — fixture fixed, suite green;
opencheck's first try hit an OpenRouter free-tier 429 preflight abort — retry
in flight (→ 1.00 if green). Also: BIRD resume dispatched on pinned SHA with
checkpoint restore
(row #8), Phase 2 exit gate measured for the first time — 1/9 pass (row #16),
artifact = run-55 blog post (surfaces 68 → 69, row #6).
**KPI:** GLOBAL-025 engine-quality measurement + onboarding/UX (distribution);
none degraded.
