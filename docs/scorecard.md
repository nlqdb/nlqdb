# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Today's lever (run 4)
makes the deferred Spider diagnosis *runnable*: the runner now buckets the
persisted `no_sql` `provider:reason` tags into a per-lane `no_sql_reasons`
tally (report JSON + CI log), so a run surfaces **why** the chain produced
no SQL instead of leaving 30+ raw strings to eyeball. Applied to the
committed BIRD baseline (3 `no_sql` rows): **`mistral:network ×3`,
`groq:circuit_open ×3`** — every scored `no_sql` carries `mistral:network`
(the chain-tail backstop erroring out; a pure rate-limit wall budget-stops,
never scores `no_sql`), so the next *engine* lever is the Mistral leg
(T11/SK-LLM-028), not the falsified column-pruner.

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

## Deltas (recent runs)

- 2026-06-13 — day-one run: scorecard created; readable metrics 0 → 12.
- 2026-06-13 (run 2) — instrument fix on #5: a `neon-provision.ts` create-path
  bug left `last_queried_at` NULL, so recorded first answers read 0/93. Fix
  seeds it at create + backfills (`0017_…`). **Measured: 0 → 93.** KPI:
  onboarding; none degraded.
- 2026-06-13 (run 3) — diagnosis correction on #7: the asserted "Spider 36
  `no_sql` = oversized DDL" is **falsified** offline (every SQLite-subset
  schema ≤ ~1,880 tok, so it can't overflow Gemini 1 M / Mistral 128 K). The
  real reasons are the `provider:reason` tags the runner already persists per
  question. Docs + one comment only; no behaviour changed ⇒ none degraded.
  KPI: engine-quality (correct backlog).
- 2026-06-14 (run 4) — **made run 3's deferred bucketing runnable.**
  `summariseLane` now lifts the `provider:reason` tags out of each `no_sql`
  row's persisted `error` into a per-lane `no_sql_reasons` tally (report JSON
  + CI summary line); absent on a clean lane (back-compat). **Measured on the
  committed BIRD baseline: `no_sql` reasons surfaced as buckets (was: 0 raw
  strings aggregated) → `mistral:network ×3`, `groq:circuit_open ×3`.** Every
  scored `no_sql` carries `mistral:network` ⇒ next engine lever is the chain
  tail (T11), not pruning. Additive optional field; no engine/runtime
  behaviour changed ⇒ no KPI degraded. KPI: engine-quality (measurement).
