# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. But the engine's biggest
lever (restore the dead Gemini leg) is **human-blocked** (Google console,
runs 6–7), there are no local BIRD/Spider fixtures + the free providers are
rate-limited (a full eval is impractical this run), so the movable number
this run is the **freshest first-value funnel number**: `seeded_ok_ratio`
(SK-STRG-008) = **0.25** first run, ~0.6–0.8 after the SK-LLM-033 prompt with
a persistent empty-DB tail. **Run 8 lever (shipped, SK-HDC-019)** attacks that
tail — see the delta below.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — measured 2026-06-12 (fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.522 | target 0.65 (GLOBAL-027) |
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` — `gemini:http_4xx` root-caused = whole-project Gemini denial. Run 7 re-probe: 2.5 → 403, **2.0-flash → 429 `limit: 0`** (no free-tier allowance), so the chain is permanently 5-of-6 and no in-code swap fixes it. Recovery = console (blocked-by-human) |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (recent runs)

- 2026-06-15 (run 8) — **deterministic seed-row salvage (SK-HDC-019).** The
  SK-HDC-018 floor dropped *all* sample rows on any one constraint-violating
  row (`seeded_ok_ratio` empty-DB tail). New pure `pruneUninsertableSampleRows`
  pre-validates and drops only the provably-uninsertable rows (unknown
  table/column, NOT-NULL gap, uncoercible type, forward/dangling FK; cascading
  parents). **Measured (unit test):** seeded rows on a one-bad-of-four seed set
  **0 → 3**; clean plans no-op (happy path unchanged); +11 db-create tests, all
  805 api tests green. KPI: onboarding + engine-quality (first-value seed
  quality). None degraded — the change only ever drops rows that would fail to
  insert anyway. Live ratio re-measure deferred to the deployed FLOW-004
  seed-quality walker.
- 2026-06-15 (run 7) — **pin-to-2.0 lever falsified (measure-first).** Live
  re-probe before touching code: gemini-2.0-flash returns `429 limit: 0` (zero
  free-tier allowance, ×3), so both 2.5 (403) and 2.0 are dead; no in-code swap
  recovers the leg. Recoverable-in-code Gemini models 1 → **0**. No code
  shipped; correction → SK-LLM-039 + `blocked-by-human.md`.
- 2026-06-14/15 (runs 5–6) — tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case) · `auth_denied` reason split (SK-LLM-039;
  deterministic, zero EX regression).
- 2026-06-13/14 (runs 1–4) — day-one scorecard (metrics 0 → 12); #5
  instrument fix (`last_queried_at` 0 → 93); Spider `no_sql` per-lane tally.
  Full history: `progress/quality-score-verification-log.md`.
