# Scorecard — current state

Point-in-time tracker, regenerated each
[`/daily`](../.claude/commands/daily.md) run. Current state only — no changelog
(≤5 KB cap). History: `git log` +
`progress/quality-score-verification-log.md` (engine).

**Weekly focus number:** *(none set — [`/weekly`](../.claude/commands/weekly.md)
sets it; the founder may override but nothing waits on them. Until then the
daily lever targets the worst **agent-movable** number below.)*

**Worst number today:** real strangers reaching a first answer = **0** — a
lagging metric; the daily **lever** targets its agent-movable input,
**indexable surfaces** (row #6). The worst *engine* number — **Spider 0.1852
vs 0.75** — is dispatch-gated: reasoning + directive levers built/saturated
(row #10 note); next gain needs the gated EX dispatch.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel** (06-25 pull; carried — analytics/D1 re-pull blocked this run) | | exclude synthetic stranger-test walker traffic |
| 1 | Visits, 7d (CF Web Analytics) | 83 / 139 pageloads (raw, incl. walker) | account-level RUM can't split per-path; genuine-stranger signal is row #2 |
| 2 | Registered users, real strangers | 0 | 7 total = 3 founder/company + 4 test/dev |
| 3 | DBs with a first answer | 130 of 130 (anon) | genuine-stranger subset still ~0 (row #2) |
| 4 | First-10-queries success rate (GLOBAL-025 onboarding KPI) | unmeasured — instrument shipped 2026-07-01, awaiting data | target ≥ 95%; D1 `first10_*` counters (migration 0020, `SK-ONBOARD-006`); one D1 query on the next pull |
| 5 | Session retention (≥ 2 queries) | unmeasured — same instrument, awaiting data | share of DBs with `first10_asks ≥ 2` (row #4 counters) |
| | **Distribution** — count *and* yield | | |
| 6 | Indexable surfaces | 64 (`/vs` 31 + `/solve` 30 + `/blog` 3) | **agent-movable daily lever** — leading input to rows #1–#3; `llms.txt` + sitemap auto-aggregate. Grow every run |
| 7 | Surface yield | published posts 3 (live, below); referral visits unmeasured | referrals to the surfaces = CF Web Analytics referrer pull (blocked this run) |
| | **Engine** — BIRD 06-19 (**12d, stale**) · Spider 06-17 (**14d, stale**) · persona-bench 06-22 | | baseline `tools/eval/baseline-2026-06-15.json` (`SK-QUAL-018`). **Dispatch gated** — `workflow_dispatch` 403 + PAT proxy-blocked (run 126) |
| 8 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12) — flat (McNemar p=0.50); reasoning levers next |
| 9 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). **Worst engine number.** Self-consistency (`SK-QUAL-017`) built bar the dispatch |
| 10 | persona-bench free-chain EX | 0.90 (18/20) | full-chain ICP EX (run 58/63); 1.7× BIRD, 4.9× Spider — the GLOBAL-026 bet; N=20 ±1 noisy. Retrieval precision@1 23/23 (run 105), held-out 17/17 — saturated |
| 11 | free-vs-frontier delta | null *(secret-blocked)* | `OPENROUTER_FRONTIER_API_KEY` empty in CI (`blocked-by-human.md`); lands when the founder sets it |
| | **Ops** — 7d, CF Workers analytics (06-22 pull) | | wall-time, all routes |
| 12 | nlqdb-api requests / errors | 990 / 0 (0.00%) | mcp 314 req, events-worker 37 req, both 0 err |
| 13 | nlqdb-api wall-time p50 / p95 | 0.94 ms / 2.62 s | p50 trivial routes, p95 LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` |
| 14 | $ spend | ~$0 | free tiers (CF/Neon/LLM) |
| | **E2E** — 4 manual `workflow_dispatch` suites (06-25 pull) | | mean(`pass × freshness`); freshness decays 1.0→0 over 7d |
| 15 | E2E manual-suite freshness | 0.00 | target > 0. 3/4 latest-green but all ≥ 7d ⇒ 0. Re-dispatch the 4 `e2e-*.yml` (dispatch-gated) |
| | **Pivot** — agent-memory wedge (GLOBAL-036) | 14/20 + 12 memory `/vs` pages | tick on merge; mirrors `agent-memory-pivot/worksheets/INDEX.md` |
| | Messaging track WS-* | 12/13 | WS-11 (self-host container) ⬜ infra-gated — the only open item |
| | Engine track E-* | 2/7 | E-01/E-02 ✅; E-03…E-07 (RLS, TTL, hybrid recall, authed on-ramp, ClickHouse) all Neon/infra-gated |

## Shipped distribution (live URLs)

Canonical copies on `/blog` (`SK-BLOG-001` autonomous publishing;
community-venue variants stay in `research/distribution-queue.md` as pointers):

- https://nlqdb.com/blog/not-in-subquery-null-trap/ (run 130 — anchors `/solve/find-rows-with-no-match-in-another-table`)
- https://nlqdb.com/blog/zep-recall-vs-analytical-agent-memory/ (run 20 — anchors `/vs/zep`)
- https://nlqdb.com/blog/null-timestamp-ttl-sweep-funnel-metric/ (run 2 — engine lesson)

## Last change

**2026-07-02 (write-safety bugfix)** — anti-rut break (rule 7: 7 consecutive
merged dailies were `/solve`+`/vs` pages; `/blog` covered by open PRs #571/#572).
Different lever: closed a verified **SK-TRUST-001 preview-gate bypass**. A
comment-prefixed write (`/* c */ UPDATE …`, `-- c\nDELETE …`) that `validateSql`
accepts as a write returned `isWriteVerb=false`, so `orchestrate.ts` **skipped the
render-before-commit diff and committed the write** (and mis-guarded exec-repair at
lines 371/399/417) — the exact smuggle `sql-validate.ts` warns about. **Before → after:**
3 comment-prefixed write cases `isWriteVerb false → true` (gated); `isWriteVerb` now
reuses the validator's `stripLeadingComments`+`leadingVerb` so the two gates can't
disagree (P5: removed the duplicated comment-blind regex). 4 regression tests added;
full api suite **830 pass / 6 skip**, tsc + biome clean. **KPI:** GLOBAL-025 UX/trust
(SK-TRUST-004 destructive-op preview integrity); none degraded.
