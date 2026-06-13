# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Today's lever is a
diagnosis correction: the documented "Spider 36 `no_sql` = oversized-DDL
request failures" is **falsified** — all 135 SQLite-subset schemas are
≤ 1,880 tok (offline-measured), so size can't be the cause. The 36 are
`gemini:http_4xx`/`mistral:network` errors whose per-question `error`
strings the runner already persists; the next run buckets those, instead of
building a column-pruner that can't help (§4 #2 reclassified).

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
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` = `gemini:http_4xx`/`mistral:network`, **not** size (schemas ≤1.9K tok, measured 2026-06-13) — see quality-score-source-of-truth §2 |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,635 / 0 (0.00%) | mcp 198 req, events-worker 143 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (this run)

- 2026-06-13 — day-one run: scorecard created; readable metrics 0 → 12.
  Finding on #5: anon create→first-answer conversion looked 0%.
- 2026-06-13 (run 2) — **instrument fix on #5.** The 0/93 was a create-path
  bug (`neon-provision.ts` INSERT omitted `last_queried_at`; the 0009
  backfill only covered pre-migration rows), which also broke the
  `SK-ANON-002` age-sweep (`NULL < cutoff` never matches). Fix: seed
  `last_queried_at` at create + backfill (`0017_…`). **Measured: recorded
  first answers 0 → 93; `last_queried_at IS NULL` rows → 0.** KPI:
  onboarding. No KPI degraded.
- 2026-06-13 (run 3) — **diagnosis correction on #7 (Spider).** The
  source-of-truth, `eval-baseline.ts`, and this card all asserted Spider's
  36 `no_sql` were "oversized-DDL request failures" and pointed the next
  engine lever at column-level pruning (§4 #2). Measured it offline (no
  LLM, no binary DBs): fetched the upstream `DDL.csv` for all 30
  SQLite-subset DBs and sized the schema for every one of the 135
  questions. **Result: max 7,520 chars (~1,880 tok), p90 ~1,531 tok, 0
  schemas > 12 K chars** — the introspected `sqlite_master` schema the
  planner sees is ≤ that. A ~1.9 K-tok schema cannot overflow Gemini (1 M)
  or Mistral (128 K), so **size is not the cause** and column pruning
  (§4 #2) cannot reduce these 36. Before → after: root cause "oversized
  DDL" (asserted, unmeasured) → "`http_4xx`/`network` on small schemas"
  (measured); the real per-question reasons are already persisted in the
  runner's `no_sql` `error` field — the next Spider run buckets them.
  Measurement-honesty class (T20/`SK-QUAL-013`). Docs + one code comment
  only; no engine/runtime behaviour changed ⇒ no KPI degraded. KPI:
  engine-quality (correct backlog prioritisation).
