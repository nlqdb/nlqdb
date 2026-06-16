# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Its biggest lever (restore
the dead Gemini leg) is **human-blocked** (Google console, runs 6–7) and a
full eval is impractical (no local fixtures, free providers rate-limited), so
**run 9** takes the adjacent measured win: a 2026-06-15 live probe (cerebras
✅ groq ✅ mistral ✅ openrouter 429 openrouter:free throttle, gemini 403) shows
the dead Gemini key sits at chain **index 1** and is the **hedge partner** for
`plan`/`schema_infer` — so every call burned a guaranteed-failed round-trip
and the slow-path hedge slot. **Run 9 lever (shipped, SK-LLM-039 rev)** parks
a denied provider on the first 401/403 — see the delta below.

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

- 2026-06-15 (run 9) — **park a denied provider on the first 401/403
  (SK-LLM-039 rev).** Live probe found the free chain healthy except Gemini
  (403, dead key, human-blocked) and OpenRouter (transient `:free` 429).
  Gemini sat at chain index 1 — and was the hedge partner for
  `plan`/`schema_infer` — yet `auth_denied` was kept out of the breaker, so
  it ate a guaranteed-failed round-trip (and the slow-path hedge slot) on
  *every* call. Now the first denial opens the breaker; the skip still
  surfaces `auth_denied` (not masked as `circuit_open`). **Measured (unit
  test):** round-trips to a dead-key provider over 5 calls **5 → 1**, and the
  hedge slot rotates to the live provider behind it. KPI: performance
  (GLOBAL-025). None degraded — inert when a key works (a 200 never trips it,
  safe regardless of prod's key), EX-neutral (provider still attempted once
  per cooldown), legibility preserved. 171 llm + 805 api tests green.
- 2026-06-15 (run 8) — **deterministic seed-row salvage (SK-HDC-019).**
  `pruneUninsertableSampleRows` drops only provably-uninsertable rows instead
  of the SK-HDC-018 all-or-nothing floor. Seeded rows on a one-bad-of-four set
  **0 → 3**; happy path unchanged. KPI: onboarding + engine-quality.
- 2026-06-15 (run 7) — **pin-to-2.0 lever falsified (measure-first).**
  gemini-2.0-flash also returns `429 limit: 0`; both 2.5 (403) and 2.0 dead,
  no in-code swap recovers the leg. No code shipped; → SK-LLM-039.
- 2026-06-14/15 (runs 5–6) — tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case) · `auth_denied` reason split (SK-LLM-039).
- 2026-06-13/14 (runs 1–4) — day-one scorecard (metrics 0 → 12); #5
  instrument fix (`last_queried_at` 0 → 93); Spider `no_sql` per-lane tally.
  Full history: `progress/quality-score-verification-log.md`.
