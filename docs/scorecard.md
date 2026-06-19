# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table; soft 5 KB cap
**relaxed while the agent-memory pivot is in flight** (GLOBAL-036) — the
20-row Pivot section mirrors [`agent-memory-pivot/worksheets/INDEX.md`](features/agent-memory-pivot/worksheets/INDEX.md)
so every WS-* / E-* status is visible at a glance; the section collapses
back to a one-line summary once the pivot completes. Published distribution
URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, **Spider 0.1852 vs 0.75**, owns it. **The Gemini free-tier
key was restored 2026-06-17** (fresh AI Studio key, mirrored to GHA + Worker)
and the full canonical Spider eval re-ran on the healed chain: raw EX
**0.1704 → 0.1852**, `no_sql` **36 → 9**, and `gemini:http_4xx`/`auth_denied`
is gone (`SK-LLM-039`). The 27 newly-answered questions mostly mismatch (hard
benchmark), so the engine bottleneck is now **SQL reasoning** (mismatches), not
provider availability. The run-15 `SK-QUAL-014` classifier buckets the 236 BIRD
mismatches: the mass is aggregation/DISTINCT **grain** + subquery **shape**,
much of it **value/literal/column grounding** (→ §4 #2 value-retrieval, now the
evidence-backed top lever); join-recall is only 35/236 (15%). BIRD unchanged
(0.522; Gemini wasn't its bottleneck, `no_sql` was 3).

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-12 · Spider 2026-06-17 (fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.522 | target 0.65 (GLOBAL-027) |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini free-tier key restored 06-17 → `no_sql` 36 → 9, `gemini:http_4xx` cleared (`SK-LLM-039`); residual 9 capacity-only. Bottleneck now SQL reasoning, not availability |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 0 / 20 | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 0 / 13 | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ⬜ | low · 1 run · — |
| WS-02 | memory `/vs` pages (one per run) | ⬜ | low · ~3 runs · WS-01 |
| WS-03 | solve pages — sharpen + sibling | ⬜ | low · ~2 runs · — |
| WS-04 | MCP tool + package + docs framing | ⬜ | low · 1 run · — |
| WS-05 | carousel analytics-over-memory slides | ⬜ | low · 1 run · — |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | ⬜ | med · ~2 runs · WS-01 |
| WS-07 | `/agents` landing | ⬜ | med · ~3 runs · WS-06 |
| WS-08 | on-brand OG / social images | ⬜ | low · ~2 runs · WS-07 |
| WS-09 | "database, not a vector store" blog + live demo | ⬜ | med · ~2 runs · WS-06 (sharpens with E-01/05) |
| WS-10 | FSL self-host messaging (GLOBAL-019 / arch §0 doc-fix shipped) | ⬜ | low · 1 run · — |
| WS-11 | pull `ghcr.io/nlqdb/api` self-host container forward | ⬜ | high · multi · WS-10 · infra-gated |
| WS-12 | home reweight + demote P1/P3/P4 to "also works for…" | ⬜ | med · ~2 runs · WS-06, WS-07 |
| WS-13 | headline reposition (hero / README / llms.txt / JSON-LD) | ⬜ | high · ~2 runs · WS-07, WS-12 · 🔒 **FOUNDER-GATED** |
| | *Engine track — E-\** | 0 / 7 | pick when worst number is engine quality / agent on-ramp |
| E-01 | `agent_memory_v1` schema preset for `db.create` | ⬜ | med · ~2 runs · — |
| E-02 | additive MCP tool `nlqdb_remember` (no rename) | ⬜ | med · 1 run · E-01 |
| E-03 | per-agent / end-user / thread compile-layer scoping | ⬜ | **high · security-critical** · ~2 runs · E-01 |
| E-04 | TTL + cron sweep (`expires_at`) | ⬜ | low · 1 run · E-01 |
| E-05 | hybrid recall — pgvector + `nlqdb_recall` | ⬜ | high · multi · E-01 · infra-gated |
| E-06 | `/agents` CreateForm uses the preset | ⬜ | low · 1 run · E-01 + WS-07 |
| E-07 | workload-analyzer rule: memory DBs → ClickHouse (Phase 3) | ⬜ | med · multi · E-01 + Phase-3 multi-engine |

## Deltas (recent runs)

- 2026-06-18 (run 16) — **column-coverage harness (`SK-QUAL-015`) — sizes the
  two halves of the §4 #2 top lever, offline.** No eval was due (Spider fresh
  06-17, BIRD 06-12, both < 7 d) and run 15 already showed a third deferred
  prompt lever buys nothing until the next eval attributes the prior ones — so
  this run produces the **deterministic, no-quota measurement §4 #2 explicitly
  requires** ("column-level recall risk … needs an offline recall harness like
  T19's first"). `bun column-coverage` reuses the pruner's own `wordTokens` to
  measure, on BIRD-dev gold (500 q, **1825** qualified column refs), the recall
  ceiling of a goal-token **column** pruner: **59.8%** of needed columns kept
  by name, **+27.4%** join/PK keys an FK/PK rule re-admits (→ ~87% achievable),
  residual **12.8%** value/measure columns (`segment`←"SME", `currency`←"CZK",
  `displayname`, `date`) the goal names by *value* — irreducible by any pruner.
  **This re-ranks §4 #2:** value-retrieval **first** (additive, zero recall
  risk, recovers the 12.8% floor — the dominant `SK-QUAL-014` mismatch class),
  column-pruning **second** and recall-gated (token-only pruning would drop 40%
  of needed columns ⇒ unsafe without key protection + a real-DDL recall run).
  KPI: engine quality (GLOBAL-025) — sharper instrument → evidence-driven lever
  ordering; none degraded (read-only over the gold JSON; no chain/scorer/runner
  change; +1 one-line `wordTokens` re-export). 9 new eval tests green; EX
  numbers unchanged (no eval dispatched). Next scheduled run targets §4 #2a
  value-retrieval.
- 2026-06-18 (run 15) — **mismatch error-class classifier + corrected loss
  breakdown (SK-QUAL-014).** The last two runs shipped prompt levers whose EX
  delta defers to the next eval, and Spider ran 06-17 (§5 forbids a
  back-to-back dispatch), so this run produces a **real, deterministic,
  no-quota measurement** instead of a third deferred lever: a committed,
  reusable classifier (`tools/eval/src/analyze-mismatches.ts` + `bun
  analyze-mismatches`) that buckets every `mismatch` row of a saved baseline
  by structural diff. Run on the canonical BIRD 500-q baseline it **overturns
  the working assumption**: a naive bare-word table regex had implied
  join-recall dominates, but with quote-aware parsing (`FROM "transactions_1k"`
  was being missed) `fewer_tables` collapses **105 → 35 (15%)**; the real loss
  mass is aggregation/DISTINCT **grain** (`agg_fn_diff` 61, `missing_DISTINCT`
  41, `extra_DISTINCT` 34) + subquery **shape** (`more_subqueries` 44), and
  reading the rows shows much of it is **value/literal/column grounding** the
  model can't guess (`'discount'` vs `'Discount'`; `Amount` vs `Price`) — the
  §4 #2 value-retrieval lever, now evidence-backed as the top mismatch lever
  (plus a slice of BIRD gold-annotation noise, §4 #5). Re-points
  `quality-score-source-of-truth.md` §2/§4/§6. 193 eval tests green (was 185);
  typecheck + lint clean. KPI: engine quality (GLOBAL-025) — sharper
  instrument → evidence-driven lever selection; none degraded (read-only over
  a saved report, no chain/scorer/runner change). EX numbers unchanged this
  run (no eval dispatched); next scheduled run targets §4 #2.
- 2026-06-18 (run 14) — **aggregate-filter HAVING directive (SK-LLM-040 /
  T22).** The newest eval (Spider) ran 06-17 and the §5 quota guardrail forbids
  a back-to-back dispatch, so this run ships a prompt-only engine-correctness
  lever (the T13–T16 directive precedent; real EX delta → next scheduled eval).
  The planner directives covered the GROUP BY half of error class E5 *Unaligned
  Aggregation Structure* (T15/SK-LLM-034) but not the **HAVING half**: a
  threshold on a group's aggregate (`HAVING COUNT(*) > 5`) was free to land in
  `WHERE`, which is either a hard error (`misuse of aggregate function` → a
  wasted exec-retry round-trip) or, worse, a silent cardinality mismatch when
  the group filter is dropped entirely — the exact mismatch mass that is now
  the Spider/BIRD bottleneck (#7). One new `PLAN_DIRECTIVES` bullet (≈55 tok):
  *filter groups by an aggregate in HAVING after GROUP BY, not WHERE; keep
  per-row predicates in WHERE* — the trailing clause bounds the inverse
  regression (row filters wrongly pushed into HAVING). Grounded in
  arXiv:2501.09310 (E5). 175 llm tests green (was 174); typecheck + lint clean.
  KPI: engine quality (GLOBAL-025); none degraded (prompt-only, orthogonal to
  every existing bullet, retry/full-schema fallbacks untouched). Real
  BIRD/Spider EX delta → next scheduled quality-eval. Funnel/ops not re-pulled
  (no analytics access this run; engine remains the GLOBAL-027 valve and the
  worst number).
- 2026-06-17 (run 13) — **join-bridge recall in schema pruning (SK-LLM-037
  rev / T21).** Engine numbers were freshly measured this morning (run 12) and
  the §5 quota guardrail forbids a back-to-back eval, so this run ships a
  **locally unit-measured** engine-correctness lever (the run-8/run-11 pattern;
  real EX delta → next scheduled eval). The pruner's FK closure was
  *outbound-only* (`REFERENCES` targets of a kept table); a junction table that
  links two goal-matched tables but whose own FK columns are generic (`a`/`b`)
  matched no goal token and was reachable by neither closure direction, so it
  was dropped — making the multi-table join unplannable (a `mismatch`, the
  current Spider/BIRD bottleneck). `pruneSchemaForGoal` now also keeps any
  table that `REFERENCES` ≥ 2 goal-matched tables, seeded from the goal-matched
  set only ⇒ **recall-monotonic** (≥ T19's 99.8% BIRD gold-table) and
  distractor-bounded (can't regress the 0.15→0.25 distractor-removal win).
  **Measured (unit, local):** synthetic `student↔enroll↔course` with generic FK
  names — bridge dropped → kept; a one-endpoint referencer stays out. 174 llm
  tests green (was 172). KPI: engine quality (GLOBAL-025); none degraded
  (add-only, retry/full-schema fallbacks untouched). Real BIRD/Spider EX delta
  → next scheduled quality-eval.
- 2026-06-17 (run 12) — **Gemini free-tier key restored + Spider re-run.**
  The shared `GEMINI_API_KEY` was rotated to a fresh free-tier AI Studio key
  (live-probed `gemini-2.5-flash` → HTTP 200) and mirrored to GHA + Worker,
  healing the whole-project denial behind the 2026-06-12 Spider losses
  (`SK-LLM-039`). Re-ran the canonical 135-q Spider eval on the healed chain:
  raw EX **0.1704 → 0.1852** (23 → 25/135), `no_sql` **36 → 9** (now
  capacity-only — `circuit_open` + `mistral:network` + `workers-ai:parse`, no
  `gemini:http_4xx`/`auth_denied`). The 27 newly-answered questions mostly
  mismatch ⇒ engine bottleneck is now SQL reasoning, not availability.
  Re-seeds `eval-baseline.ts` (Spider only; BIRD unchanged). KPI: engine
  quality (GLOBAL-025); none degraded. Resumed across 2 windows
  (27679511189 hit the 60-min ceiling → 27683263668 completed).
- 2026-06-16 (run 11) — **execution-guided repair: feed a re-plannable PG
  exec error back to the planner (SK-ASK-022).** A deterministic-but-fixable
  exec error (42703 undefined_column, 42803 GROUP BY, 42883/42725 function,
  42702 ambiguous, 42P18/42804/42846 type, 22P02 cast, 42601 syntax — the set
  lives in `exec-repair.ts`) was replayed identically 3× by SK-ASK-013's
  transient retry, then surfaced `db_unreachable`. The planner never saw the
  DB's own error, even though the plan prompt already diagnoses
  `previousAttempt.error` against the full schema. Now such an error bails the
  transient retry after one attempt and re-plans **once** with the error fed
  back (reads only; a repaired write is rejected `write_via_repair`, never run
  — preserves the SK-TRUST-001 preview gate). **Measured (orchestrator unit
  tests, stubbed exec/LLM):** on a 42703 → fixed-column scenario, recovery
  **db_unreachable → rows (0 → 1)** with exec round-trips on the deterministic
  error **3 → 2** (1 fail + 1 repaired, vs 3 identical replays); repair bounded
  to once; a repaired write blocked before exec. KPI: engine quality
  (GLOBAL-025), with a performance assist (fewer doomed replays). None degraded
  — failure-path only (zero happy-path latency, SK-ASK-002 budget untouched),
  schema_mismatch (42P01/3F000) still bails as before. 808 api tests green
  (was 805). Full BIRD/Spider EX delta → next scheduled quality-eval.
- 2026-06-15/16 (runs 7–10) — provider-resilience wave: pin-to-2.0 falsified
  (run 7) → park a denied provider on the first 401/403 (run 9, SK-LLM-039)
  with a 30-min cooldown (run 10; dead-key round-trips 10 → 1) ·
  deterministic seed-row salvage (run 8, SK-HDC-019; 0 → 3).
- 2026-06-13/15 (runs 1–6) — day-one scorecard (metrics 0 → 12); #5 instrument
  fix (`last_queried_at` 0 → 93); tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case). Full history:
  `progress/quality-score-verification-log.md`.
