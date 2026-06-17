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
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve). **Run 12
re-measured the genuine-stranger first-value path** (the worst-number lane) with
the FLOW-004 seed-quality probe and found the bottleneck has *moved*: the
empty-DB `seeded_ok_ratio` SK-HDC-018/019 fixed is now **1.0** (was 0.25 on
06-10), but on a harder 8-goal P1 set **3 of 8 goals hard-fail at provision
with `infer_failed` (HTTP 422)** — the stranger gets *no DB at all*, the harshest
first-value outcome, and the ratio hides it (provision-fails are excluded).
Captured against prod, the deterministic slice is `plan_invalid issue_count:1`:
the model names a column a Postgres reserved word the schema-infer prompt's short
list doesn't cover. **Run 12 ships the NOT-blocked lever (SK-HDC-020):**
`inferSchema` now re-infers **once** with the Zod issue fed back (the typed-plan
analogue of run 11's SK-ASK-022), recovering the `plan_invalid` slice. The
Gemini-restore lever stays **human-blocked** (console, runs 6–7); engine
BIRD/Spider row still fresh (< 7 d) so no dispatch this run.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| 5a | First-value seed-quality (`seeded_ok_ratio`, FLOW-004 probe) | **1.0** default 4-goal set; **1.0** over 5 classified creates on harder 8-goal set | re-measured 2026-06-17 (was 0.25 on 06-10). BUT **3/8 harder goals → `infer_failed` 422** (no DB) — the new first-value bottleneck; deterministic slice = reserved-word `plan_invalid`, fixed by SK-HDC-020 (run 12) |
| | **Engine — measured 2026-06-12 (fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.522 | target 0.65 (GLOBAL-027) |
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` — `gemini:http_4xx` root-caused = whole-project Gemini denial. Run 7 re-probe: 2.5 → 403, **2.0-flash → 429 `limit: 0`** (no free-tier allowance), so the chain is permanently 5-of-6 and no in-code swap fixes it. Recovery = console (blocked-by-human) |
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

- 2026-06-17 (run 12) — **validation-guided re-inference for db.create
  (SK-HDC-020).** The FLOW-004 seed-quality probe re-measured the genuine-
  stranger first-value path: `seeded_ok_ratio` **0.25 (06-10) → 1.0** (the
  SK-HDC-018/019 empty-DB fix is holding), but the harder 8-goal P1 set
  exposed a *new* worst outcome — **3/8 goals `infer_failed` (HTTP 422), no DB
  at all**, hidden from the ratio (provision-fails excluded). Root-caused
  against prod: the deterministic slice is `plan_invalid issue_count:1` — a
  column named a Postgres reserved word the schema-infer prompt's short list
  misses. `inferSchema` returned immediately on `plan_invalid`; now it re-infers
  **once** with the rejected plan + Zod issue fed back (via new
  `SchemaInferRequest.previousAttempt`), the typed-plan analogue of run 11's
  execution-guided repair (SK-ASK-022). **Measured (same-seed, Cerebras
  gpt-oss-120b, temp 0):** the "fitness log…" goal infers valid **0/3 → repaired
  3/3**; unit tests pin the loop (810 api tests green, was 808). KPI: engine
  quality + onboarding (GLOBAL-025). None degraded — failure-path only (zero
  happy-path latency/cost), `llm_failed`/`ambiguous_goal` unchanged, client
  still sees only `issue_count` (GLOBAL-012). Live re-measure waits on a deploy.
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
