# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤5 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — [`/weekly`](../.claude/commands/weekly.md)
sets it; until then the daily lever targets the worst **agent-movable**
number below.)*

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable input,
**indexable surfaces** (row #6). The worst *engine* number — **Spider 0.1852
vs 0.75** — is **dark** (rule 8): dispatch blocked since run 126 (GitHub App
+ PAT both 403, retested 07-02); top bullet in `blocked-by-human.md`.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-02 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 79 / 104 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company (06-28 signup = founder's work email) + 4 test/dev |
| 3 | DBs with a first answer | 157 of 157 (anon) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data yet — instrument **live in prod since 07-02**, counters verified | target ≥ 95%; 0 asks since deploy — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | 67 (`/vs` 31 + `/solve` 30 + `/blog` 6) | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run |
| 7 | Surface yield | posts 6; 7d external referrals = 2 (1 `google.com` organic — first — + 1 `aisearchindex.space`) | CF `refererHost` pull unblocked 07-02 — measured every run |
| | **Engine** — BIRD 06-19 (**13d, stale**) · Spider 06-17 (**15d, stale**) · persona-bench 06-22 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`); **dark** — dispatch 403 (retested 07-02) |
| 8 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12) — flat (McNemar p=0.50) |
| 9 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). **Worst engine number, dark.** `SK-QUAL-017` built bar the dispatch |
| 10 | persona-bench free-chain EX | 0.90 (18/20) | full-chain ICP EX; 1.7× BIRD, 4.9× Spider — the GLOBAL-026 bet; N=20 ±1 noisy. Retrieval precision@1 saturated (23/23 + 17/17 held-out) |
| 11 | free-vs-frontier delta | null *(secret-blocked)* | `OPENROUTER_FRONTIER_API_KEY` empty in CI (`blocked-by-human.md`); lands when the founder sets it |
| | **Ops** — 7d, CF Workers analytics (fresh 07-02 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,125 / 0 (0.00%) | mcp-server 858 req / 1 err, events-worker 0 req |
| 13 | nlqdb-api wall-time p50 / p95 | 0.88 ms / 0.87 s | p95 down from 2.62 s (06-22); `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites (fresh 07-02 pull) | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | 0.00 | sdk ✅05-31 · **mcp ❌06-24 (failed)** · examples ✅05-31 · opencheck ✅06-12 — all ≥7d ⇒ 0; re-run dispatch-gated |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001`); venue variants stay in
`research/distribution-queue.md` as pointers:

- https://nlqdb.com/blog/agent-memory-vector-store-aggregation-gap/ (run 53 — anchors `/vs/pinecone`)
- https://nlqdb.com/blog/store-form-submissions-without-a-backend/ (run 106 — anchors `/solve/store-form-submissions-without-backend`)
- https://nlqdb.com/blog/not-in-subquery-null-trap/ (run 130 — anchors `/solve/find-rows-with-no-match-in-another-table`)
- https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/ (run 20 — anchors `/vs/zep`)
- https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/ (run 2 — engine lesson)
- https://nlqdb.com/blog/mcp-server-what-does-the-agent-own/ (run 102 — anchors `/vs/hex`)

## Last change

**2026-07-02 pm (blog publish)** — run-102 draft (oldest unpublished) →
**/blog/mcp-server-what-does-the-agent-own**: surfaces **66 → 67**, posts
5 → 6. Funnel/ops rows keep today's am pull; engine rows untouched —
open PR #580 owns them. **KPI:** GLOBAL-025 onboarding/UX; none degraded.
