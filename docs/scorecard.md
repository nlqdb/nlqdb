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
provider availability — the §4 levers in `quality-score-source-of-truth.md`
target it. BIRD unchanged (0.522; Gemini wasn't its bottleneck, `no_sql` was 3).

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

- 2026-06-18 (run 14) — **join-key directive in the planner prompt
  (SK-LLM-040 / T22).** Engine numbers are fresh (Spider re-measured run 12,
  06-17; BIRD 06-12, 6 d < the 7-d staleness alert) and §5 forbids a
  back-to-back eval, so this run ships a **prompt-only, unit-measured** engine
  lever (the T10–T16 directive pattern; real EX delta → next scheduled eval).
  The current Spider/BIRD bottleneck is **SQL-reasoning mismatches** (BIRD
  500-q 06-12: mismatch 236, `no_sql` 3), and **join errors** — joining on the
  wrong foreign-key columns — are a named, prevalent category in the
  text-to-SQL error studies (arXiv:2501.09310) not yet covered by any directive
  (T10/T13–T16 cover projection/NULL/count/group/cast; T19/T21 keep join tables
  *present* but don't constrain the join *predicate*). New `PLAN_DIRECTIVES`
  bullet: join on the column pair the schema declares as `FOREIGN KEY ...
  REFERENCES`, not a same-named / non-key column; fall back to corresponding
  key columns when no FK is declared (Spider's SQLite subset omits them — the
  regression bound). Grounded in the FK clauses the DDL already carries verbatim
  (~70 tok, no new context). **Measured (unit):** prompt-render test pins the
  declared-FK predicate + the FK-less fallback + the silent-wrong-rows
  mechanism; 175 llm tests green (was 174). No exemplar refit (keeps
  SK-LLM-026's pending per-lever measurement clean). KPI: engine quality
  (GLOBAL-025); none degraded (prompt-only, orthogonal to every other bullet,
  retry/full-schema paths untouched). Real BIRD/Spider EX delta → next
  scheduled quality-eval.
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
- 2026-06-16 (run 10) — **park a denied provider for 30 min, not 60 s
  (SK-LLM-039 rev).** Run 9 opened the breaker on the first 401/403 but left
  the default 60 s cooldown, so a long-lived worker isolate re-probed the dead
  Gemini key — and re-burned the slow-path hedge slot — once a minute. A
  401/403 is human-gated (console/billing) and an env re-key arrives as a
  deploy (which resets the in-memory breaker anyway), so the 60 s re-probe
  never caught a recovery. New `AUTH_DENIED_COOLDOWN_MS = 30 min`.
  **Measured (unit test, fake-clock 10-min isolate at 1 plan/min):**
  round-trips to a dead-key provider **10 → 1** (10×), hedge slot freed for
  the live provider for the whole window; a transient 403 still self-heals on
  the periodic re-probe. KPI: performance (GLOBAL-025). None degraded — inert
  when a key works (a 200 resets the breaker), EX-neutral (provider still
  re-probed each window), legibility preserved (skip stays `auth_denied`).
  172 llm tests green (was 171).
- 2026-06-15 (run 9) — **park a denied provider on the first 401/403
  (SK-LLM-039 rev).** Gemini (dead key, chain index 1, hedge partner) ate a
  guaranteed-failed round-trip + the hedge slot on *every* call; now the first
  denial opens the breaker (skip stays legible as `auth_denied`). Measured:
  dead-key round-trips over 5 calls **5 → 1**, hedge rotates to a live
  provider. KPI: performance. 171 llm + 805 api green.
- 2026-06-15 (run 8) — **deterministic seed-row salvage (SK-HDC-019).** Drops
  only provably-uninsertable rows; seeded rows on one-bad-of-four **0 → 3**.
- 2026-06-15 (run 7) — **pin-to-2.0 lever falsified.** gemini-2.0-flash also
  `429 limit: 0`; no in-code swap recovers the leg. → SK-LLM-039.
- 2026-06-14/15 (runs 5–6) — tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case) · `auth_denied` reason split (SK-LLM-039).
- 2026-06-13/14 (runs 1–4) — day-one scorecard (metrics 0 → 12); #5
  instrument fix (`last_queried_at` 0 → 93); Spider `no_sql` per-lane tally.
  Full history: `progress/quality-score-verification-log.md`.
