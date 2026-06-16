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
full eval is impractical here (no local SQLite fixtures, free `:free` tiers
throttled). **Run 10** ships the repeatable instrument behind every prior
run's ad-hoc probe — `scripts/probe-free-chain.mjs` hits each provider's
**exact prod planner-tier model** — and it surfaces a measured engine-capacity
win: the 2026-06-12 Spider baseline blamed `no_sql` on two dead planner legs
(`gemini:http_4xx` + `mistral:network`); today only **one** is dead. See the
delta below.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15 (carried; no new traffic day-over-day, distribution lane is the mover)** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — EX measured 2026-06-12 (fresh, < 7d); chain health probed 2026-06-16** | | EX: `apps/api/src/gate/eval-baseline.ts` · health: `scripts/probe-free-chain.mjs` |
| 6 | BIRD raw EX | 0.522 | target 0.65 (GLOBAL-027) |
| 7 | Spider raw EX | 0.1704 | target 0.75; baseline's 36/135 `no_sql` blamed two dead planner legs (`gemini:http_4xx` + `mistral:network`). **2026-06-16 probe (prod planner models): cerebras ✅ 644ms · groq ✅ 264ms · mistral ✅ 935ms (recovered) · openrouter `qwen3-coder:free` 429 (throttle) · gemini 403 (dead, blocked-by-human).** Only Gemini is now a structural dead leg; a re-run should recover the `mistral:network` losses |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (recent runs)

- 2026-06-16 (run 10) — **repeatable free-chain health probe
  (`scripts/probe-free-chain.mjs`) + a measured capacity win.** One command
  replacing every prior run's ad-hoc curl; probes each provider's **exact prod
  planner-tier model** (`plan`-op IDs) so the signal matches what EX rides on.
  Delta: **structural dead planner legs 2 → 1.** The 2026-06-12 Spider
  baseline blamed `no_sql` on `gemini:http_4xx` **and** `mistral:network`;
  today mistral answers (200, 935ms) — only Gemini is dead. KPI:
  engine-quality (GLOBAL-025); recovered backstop ⇒ less chain exhaustion.
  None degraded (read-only, EX baseline untouched until a real re-run).
- 2026-06-15 (run 9) — **park a denied provider on the first 401/403
  (SK-LLM-039 rev).** Gemini sat at chain index 1 and was the `plan`/
  `schema_infer` hedge partner, yet `auth_denied` was kept out of the breaker
  → a guaranteed-failed round-trip per call. Now the first denial opens the
  breaker, still surfacing `auth_denied` not `circuit_open`. **Measured (unit
  test):** dead-provider round-trips over 5 calls **5 → 1**. KPI: performance.
  Inert when a key works; EX-neutral. 171 llm + 805 api tests green.
- 2026-06-15 (run 8) — **seed-row salvage (SK-HDC-019):** drop only provably-
  uninsertable rows; seeded rows **0 → 3** on a one-bad-of-four set.
- 2026-06-14/15 (runs 5–7) — tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case) · `auth_denied` split (SK-LLM-039) · pin-to-2.0
  Gemini lever falsified (2.0 also `429 limit:0`).
- 2026-06-13/14 (runs 1–4) — day-one scorecard (0 → 12 metrics); #5 instrument
  fix (`last_queried_at` 0 → 93). Full history:
  `progress/quality-score-verification-log.md`.
