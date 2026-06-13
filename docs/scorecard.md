# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane). Engine-side worst: Spider 0.1704 vs 0.75 target.
Today's lever fixed the *instrument*, not the number: the anon
first-answer metric (#5) was structurally pinned at 0 by a create-path
bug, masking the true signal.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-13** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 114 visits / 175 pageloads | includes browser-walker traffic; not yet splittable |
| 2 | Waitlist rows, real | 4 of 67 | 63 walker rows; of the 4, 1 founder + 3 probe-looking (`@wshu.net`, `@example.test`) → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9 this wk / 26 last wk | cap 200/wk — no exhaustion risk; mostly walker-triggered |
| 5 | Anon DBs with a recorded first answer | **93 of 93** (was 0) | **Instrument fixed this run.** Was 0/93 — a measurement artifact, not behaviour: the create path (`neon-provision.ts`) left `last_queried_at` NULL, and the only toucher is `/v1/ask` query mode, which anon never reaches (call #1 = create short-circuit `SK-ANON-013`; call #2 = auth-walled `SK-ANON-012`). Every successful create returns sampleRows = the answer, so all 93 *had* answered. Fix seeds `last_queried_at` at create + backfills existing rows. Genuine-stranger subset still ~0 (rows #2/#3) — that's the real worst-number, now honestly measured |
| | **Engine — measured 2026-06-12 (fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.522 | target 0.65 (GLOBAL-027) |
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` are oversized-DDL request failures (see quality-score-source-of-truth §2) |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,635 / 0 (0.00%) | mcp 198 req, events-worker 143 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (this run)

- 2026-06-13 — day-one run: scorecard created; measured-numbers-readable
  0 → 12. No code lever pulled (per `/daily`, creating the file is the
  complete day-one run). Finding logged on #5: anon create→first-answer
  conversion is 0% even for walkers — candidate worst-number lever.
- 2026-06-13 (run 2) — **instrument fix on #5.** Investigated the day-one
  finding: the 0/93 was a create-path bug, not a conversion failure.
  `neon-provision.ts` INSERT omitted `last_queried_at`; the 0009 backfill
  only covered rows existing at migration time, so all 93 post-migration
  anon DBs were NULL. Two consequences repaired: (1) the metric now counts
  real first answers; (2) the age-sweep (`db-sweep/sweep.ts`,
  `last_queried_at < cutoff`) never matched NULL → anon DBs never aged out,
  contradicting `SK-ANON-002`'s 90-day TTL. Fix: seed `last_queried_at =
  unixepoch()` at create + one-time backfill (`0017_…`, applied to remote).
  **Measured: anon DBs with a recorded first answer 0 → 93; table-wide
  `last_queried_at IS NULL` rows → 0.** Δ ≥ 0, kept. KPI: onboarding
  (instrument honest + retention-TTL conformance). No KPI degraded.
