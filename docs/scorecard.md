# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Today's lever closes the
diagnosis gap run 3 found: the 36 Spider `no_sql` `gemini:http_4xx` rows
were unbucketable because the runner persisted only the failure *class*, not
the HTTP status — and a `429` (quota), `403` (key/project denied), and
`400` (bad request) need opposite fixes. `SK-QUAL-014`
(`runner.ts::describeChainFailure`) now appends each leg's status, so the
next Spider run buckets the 36 by status. Verified the ambiguity is real:
the env's Gemini key returns `403 PERMISSION_DENIED` ("project denied
access") on a control `plan()` call — a config-class 4xx the old string
would have hidden inside `gemini:http_4xx`.

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
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` = `gemini:http_4xx`/`mistral:network`, **not** size (schemas ≤1.9K tok). `SK-QUAL-014` persists each leg's HTTP status so the next run buckets the 36 by status (429/400/403) — see quality-score-source-of-truth §2 |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,635 / 0 (0.00%) | mcp 198 req, events-worker 143 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (newest first; older runs terse — full detail in git + source-of-truth)

- 2026-06-13 (run 4) — **instrument fix on #7 (Spider) diagnosability.**
  The runner persisted only the failure *class* (`gemini:http_4xx`), dropping
  the `ProviderError.status` that separates 429 (quota) / 403 (config) / 400
  (engine bug) — three 4xx causes with opposite fixes. `SK-QUAL-014`
  (`runner.ts::describeChainFailure`, exported + unit-tested) appends each
  leg's status: `gemini:http_4xx` → `gemini:http_4xx(403)`. Verified the
  ambiguity is real — the env Gemini key returns `403 PERMISSION_DENIED` on a
  control `plan()`. Eval-only; `GLOBAL-012` untouched; report schema unchanged
  so prior baselines stay valid; no KPI degraded. KPI: engine-quality (the
  next Spider run's 36 `no_sql` become bucketable).
- 2026-06-13 (run 3) — diagnosis correction on #7: Spider's 36 `no_sql` are
  `http_4xx`/`network` on small schemas (every SQLite-subset schema ≤1.9K tok,
  offline-measured), **not** "oversized DDL" (falsified) ⇒ column-pruning §4#2
  can't reduce them. Docs only; no KPI degraded.
- 2026-06-13 (run 2) — instrument fix on #5: recorded first answers 0 → 93
  (`neon-provision.ts` left `last_queried_at` NULL; seed at create + backfill
  `0017_…`). KPI: onboarding. No KPI degraded.
- 2026-06-13 (run 1) — day-one: scorecard created; readable metrics 0 → 12.
