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
(4th-run) pick: **the headline-KPI smoke was structurally hung, not
quota-starved** — 4 consecutive windows ceiling-cancelled at 44 min with a
byte-flat checkpoint; root cause was a runaway predicted query executing in
uninterruptible in-process bun:sqlite, replayed at the same resume point
every window. Fixed by `SK-QUAL-021` (killable-subprocess SQL exec; the
repro that hung forever now scores `exec_error` at the deadline). **BIRD
0.512 stays below its ≥ 0.60 Phase 2 floor** — engine work ships until
cleared (`SK-QUAL-005`). Phase 2 exit gate: **1/9 criteria pass** (row #16).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (fresh 07-03 pull — CF GraphQL + remote D1) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 93 / 118 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 8 total = 4 founder/company + 4 test/dev (unchanged) |
| 3 | DBs total | 160, all with `last_queried_at` (anon + walker) | stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | no data — instrument live (migration 0020 applied), counters all zero | target ≥ 95%; still zero `/v1/ask` since the 07-02 deploy (latest `last_queried_at` = 07-02 09:25 UTC, 28h+ quiet) — reads on next pull with traffic |
| 5 | Session retention (≥ 2 queries) | no data yet — same instrument, awaiting traffic | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | 73 (`/vs` 31 + `/solve` 31 + `/blog` 11) | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run |
| 7 | Surface yield | posts 11; 7d external referrals = 3 (`www.google.com` + `aisearchindex.space` + `bing.com`, 1 pageload each) | CF `refererHost` — measured every run |
| | **Engine** — BIRD 07-03 · Spider 07-02 · persona-bench 07-02 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`) |
| 8 | BIRD raw EX | **0.512** (256/500, 07-03 — first completed 500q canonical since 06-19; Δ −0.8 pp vs 0.520, McNemar p=0.36 statistically flat, 0 flagged regressions; [run 28640034273](https://github.com/nlqdb/nlqdb/actions/runs/28640034273)) | target 0.65 / **Phase 2 floor 0.60 — below floor ⇒ engine work ships until cleared (`SK-QUAL-005`)**. Resume loop closed (4 checkpointed windows), baseline re-seeded 07-03; pin-branch delete blocked by session push scope — any session with branch-delete rights can drop `eval/bird-resume-0e67e64` |
| 9 | Spider raw EX | 0.1926 (26/135, 07-02) | target 0.75; was 0.1852 (06-17). **Worst engine number.** 07-02 free lane capacity-throttled ⇒ undercounts; `SK-QUAL-017` SC smoke undispatched |
| 10 | persona-bench free-chain EX | 0.9565 (22/23, 07-02) | full-chain ICP EX; 1.8× BIRD, 5× Spider — the GLOBAL-026 bet; N=23 ±1 noisy. Retrieval precision@1 saturated |
| 11 | free-vs-frontier delta | 0.00 pts (persona-bench 07-02); **BIRD agentic lane: still unmeasured — smoke was hung, not quota-starved; hang fixed (`SK-QUAL-021`), awaiting first post-fix dispatch** | windows 1–4 (07-03) all ceiling-cancelled at 44 min with a **byte-flat checkpoint** (window 4: restored 10,925 B → saved 10,927 B): a runaway predicted query in uninterruptible in-process bun:sqlite blocked the runner at the same deterministic resume point every window — run-69's "free chain drained" hypothesis was wrong. Fixed: scoring SQL now runs in a killable subprocess; a runaway scores `exec_error` at the deadline. **Resume: after this PR merges, dispatch `quality-eval-bird-mini.yml` `mode: smoke` + `include_agentic_frontier` on `main`** (the stranded dgcfus-branch checkpoint is unreadable from `main` scope and held ~nothing — a fresh slice is correct) |
| | **Ops** — 7d, CF Workers analytics (fresh 07-03 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 1,949 / 0 (0.00%) | mcp-server 816 req / 0 err; events-worker 2 req |
| 13 | nlqdb-api wall-time p50 / p95 | 1.0 ms / 876 ms | mcp-server p95 331.8 s = long-lived SSE, expected; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | **0.64** (natural 1-day decay from 0.75) — sdk ✅ 07-02 · mcp ✅ 07-02 · examples ✅ 07-02 · opencheck ❌ (last ✅ 06-12 ⇒ freshness 0) | opencheck failed twice 07-02 on OpenRouter free-tier 429 (driver LLM throttled — infra, not product); its driver shares free-LLM capacity with the eval lanes (BIRD burned it again 07-03) — dispatch opencheck on an eval-free day |
| | **Phase plan** — [`phase-plan.md`](phase-plan.md) exit gates | | no gate, no phase rollover |
| 16 | Phase 2 (Distribution) exit gate | **1/9 pass** (first measurement, 07-02) — pass: inference cost < $1/mo/user ($0). Fail: BIRD ≥ 0.60 free (0.512, fresh 07-03); agentic-frontier ≥ 0.80 + Δ ≤ 25 pp (**runner hang fixed, first post-fix dispatch pending, row #11**); TTFV p50 ≤ 60 s (unmeasured); first-10 ≥ 95% (no data, row #4); destructive-op retry < baseline (unmeasured); MCP in 3+ host apps (no instrument); 1 public agent product on nlqdb (0 strangers); 3 non-engineer CSV tests (CSV upload unshipped) | agent-movable next: finish the row #11 agentic smoke resume, first-10 instrument reads with traffic; stranger-dependent criteria hang on rows #2/#6 |
| 17 | Genuinely-open question bullets, `docs/features/*/FEATURE.md` | **38** (07-03, was 39; 166 total bullets, 128 resolved/parked/decided) | target ↓ 0 — **method now pinned** (stops the 75↔85 drift): `- ` bullets under `## Open questions` whose text does **not** match, **case-insensitively**, `Resolved\|Shipped\|~~\|Parked\|Deferred\|Decided:\|Closed` (case-insensitive is load-bearing — lowercase `resolved`/all-caps `RESOLVED` mark done bullets; a case-sensitive grep over-counts to 53). Lever: research (P2/GLOBAL-033) → document (P4) → mark resolved/delete |
| 18 | Dead + redirecting links, built surfaces | **0 dead / 0 redirecting** (07-03 4th-run sweep: 92 pages, 2,063 internal links) | target 0 — sweep is repeatable: `bun run --filter @nlqdb/web build && bun run --filter @nlqdb/web check:links` (checks hrefs + sitemap + llms.txt against dist; exits 1 on dead) |
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

## Last change

**2026-07-03 (4th run)** — lever: **the headline-KPI smoke's real blocker
found and fixed (`SK-QUAL-021`, row #11)**. Window 4 (dispatched this run to
resume the row #11 slice) ceiling-cancelled like windows 1–3 — but with the
checkpoint **byte-flat** (10,925 B restored → 10,927 B saved): zero pairs
scored in 44 min, disproving run-69's "free chain drained" hypothesis. Root
cause: gold/predicted SQL executed synchronously in-process via bun:sqlite,
which exposes no interrupt — one runaway predicted query froze throttle,
capacity-wait, budget-stop and checkpoint at the same deterministic resume
point every window. Fix: all scoring SQL now executes in a killable
subprocess with a hard deadline; measured before → after: the runaway repro
**hung indefinitely → scores `exec_error` in 0.3 s** (regression tests added;
277 eval tests green). Also measured this run: surfaces 72 → 73, visits
84 → 93, link sweep clean over 92 pages / 2,063 links, docs-ambiguity count
method pinned + made reproducible (case-insensitive exclusion; **38**
genuinely-open of 166, row #17 — supersedes the earlier 85; one bullet
resolved via P2 = frontier OpenAI IDs, one resolved-cruft cli bullet deleted).
Artifact = run-109 blog post `/blog/text-to-sql-build-vs-buy/` (+ run-131
distribution-queue draft on fail-loud model-ID defaults). **KPI:** GLOBAL-025
engine-quality (the headline-delta instrument can now finish a window) +
onboarding/UX (distribution +1, docs clarity); none degraded — no code
behavior changed (frontier defaults still empty; `tiers.ts` comment-only).
