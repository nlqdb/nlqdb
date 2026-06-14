# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Today's lever (run 5)
acts on run 4's diagnosis: every scored `no_sql` on the committed BIRD
baseline (3/3) carries a transient `mistral:network` at the **chain tail**,
where the Mistral capacity backstop (SK-LLM-028) has no provider to fail
over to — so a single momentary fetch blip permanently loses a question the
backstop exists to recover. Live probe confirms Mistral is healthy (HTTP
200, ~0.6 s), so these are transient, not an outage. **SK-LLM-038** retries
the chain tail once (150 ms backoff, abort-aware) on `network`/`http_5xx`
before declaring total failure — tail-only, strictly additive (can only
convert a would-be failure → success), zero added latency on any
succeeding call. Next engine lever after this: the Spider `gemini:http_4xx`
losses (run 3 obs), once freshly bucketed.

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

- 2026-06-13 (runs 1–3) — day-one scorecard (metrics 0 → 12); #5 instrument
  fix (`last_queried_at` NULL → seeded + backfilled, **0 → 93**, onboarding);
  #7 diagnosis correction (Spider "oversized-DDL" `no_sql` **falsified** — all
  schemas ≤ 1.9 K tok, real cause is the persisted `provider:reason` tags).
- 2026-06-14 (run 4) — bucketed the persisted `no_sql` `provider:reason` tags
  into a per-lane `no_sql_reasons` tally (report JSON + CI line). **Measured
  on the BIRD baseline → `mistral:network ×3`, `groq:circuit_open ×3`** ⇒ next
  engine lever = the chain tail (T11/SK-LLM-028), not pruning. Additive; no
  behaviour changed ⇒ none degraded. KPI: engine-quality (measurement).
- 2026-06-14 (run 5) — **tail transient retry (SK-LLM-038).** The chain
  tail has no fallback, so the 3/3 BIRD-baseline `no_sql` rows that all
  carry `mistral:network` died on a momentary blip (Mistral healthy: live
  probe HTTP 200 / 0.6 s). The router now retries the tail once on
  `network`/`http_5xx`. **Measured:** deterministic — 5 new router tests
  prove recovery + bounded (≤1) retry + tail-only scoping (169/169 llm
  tests green); on `baseline-2026-06-15.json` all 3/3 scored `no_sql` are
  now retryable, BIRD EX **0.522 → best-case 0.528** (+0.6 pp), worst-case
  unchanged — strictly non-regressing (tail-only, additive). KPI:
  engine-quality. None degraded (zero latency on succeeding calls).
