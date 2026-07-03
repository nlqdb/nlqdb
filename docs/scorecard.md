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
pick: **dead/redirecting links on deployed surfaces (row #18) were unmeasured**
— the sweep now exists and found 0 dead but **1,147 redirecting bare-path
internal links** (every nav/footer/hub link cost a 307 hop), fixed to 0. Vs
GLOBAL-025 floors, Spider free (0.1926) clears ≥ 0.15; **BIRD 0.520 is below
its ≥ 0.60 Phase 2 floor** (resume loop continuing, row #8). Phase 2 exit
gate: **1/9 criteria pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-03 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 80 / 102 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; still zero `/v1/ask` since the 07-02 deploy (latest `last_queried_at` = 07-01 ~09:25 UTC) — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | 70 (`/vs` 31 + `/solve` 31 + `/blog` 8) | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run |
| 7 | Surface yield | posts 8; 7d external referrals = 2 (1 `www.google.com` organic + 1 `aisearchindex.space`) | CF `refererHost` — measured every run |
| | **Engine** — BIRD 06-19 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | 0.520 (06-19) — **resume loop running** on pinned SHA `0e67e64` (branch `eval/bird-resume-0e67e64`): [run 28622844664](https://github.com/nlqdb/nlqdb/actions/runs/28622844664) reached 357/500 attempted (partial attempted-only free EA 54.9%), budget-stopped `resumable: true`; next window dispatched 07-03 | target 0.65 / Phase 2 floor 0.60; loop until report says `resumable: false`, then update baseline + verification log + delete the pin branch. Don't score partial EA as the number |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | 0.00 pts (persona-bench 07-02) | frontier key wired; agentic lane (`SK-QUAL-004` headline) unrun |
| | **Ops** — 7d, CF Workers analytics (fresh 07-03 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 2,127 / 0 (0.00%) | mcp-server 822 req / 0 err; events-worker 1 req |
| 13 | nlqdb-api wall-time p50 / p95 | 0.9 ms / 872 ms | mcp-server p95 331.8 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.64** (natural 1-day decay from 0.75) — sdk ✅ 07-02 · mcp ✅ 07-02 · examples ✅ 07-02 · opencheck ❌ (last ✅ 06-12 ⇒ freshness 0) | opencheck failed twice 07-02 on OpenRouter free-tier 429 (driver LLM throttled — infra, not product); its driver shares free-LLM capacity with the eval lanes and the BIRD resume loop is burning that today too — dispatch opencheck on an eval-free day |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.520); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (lane unrun); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: BIRD floor (row #8 resume), agentic lane dispatch, first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Unresolved open-question bullets, `docs/features/*/FEATURE.md` | 75 (07-03; 92 parked per GLOBAL-033, excluded) | target ↓ 0 — **agent-movable**: research (P2/GLOBAL-033) → document (P4) → delete or park |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-03, first full sweep: 88 pages, 1,969 internal links; found 0 dead + 1,147 redirecting bare-path links → all fixed) | target 0 — sweep is now repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
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

## Last change

**2026-07-03** — lever: **link integrity on built surfaces (row #18)
unmeasured → measured, 1,147 redirecting links → 0**: built the repeatable
sweep (`apps/web/scripts/check-links.mjs`, `check:links` script) over the 88
built pages + sitemap + llms.txt — 0 dead links, but 1,147 internal links
(every nav/footer/hub link) pointed at bare paths that 307-redirect under
`trailingSlash: "always"` (the run-69 lesson covered canonicals only);
normalized all to the 200 URL at source. Re-measure: 0 dead / 0 redirecting.
Also: BIRD resume loop continued — window 2 reached 357/500 `resumable: true`,
window 3 dispatched on the pinned SHA (row #8); artifact = run-67 blog post
(surfaces 69 → 70, row #6).
**KPI:** GLOBAL-025 UX/performance (one 307 hop removed from every internal
navigation + crawl edge) + onboarding (distribution); none degraded.
