# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. **Run 7 (measure-first):**
the run-6 plan to recover Gemini cheaply by pinning the default model to
`gemini-2.0-flash` is **falsified by live probe** — gemini-2.0-flash / -001
return `429 limit: 0` for `generate_content_free_tier_requests` (stable across
3 retries), i.e. *zero* free-tier allowance, not the transient throttle run 6
assumed. The shared `GEMINI_API_KEY` project is off the free tier on **every**
model (2.5 → 403 denied, 2.0 → 429 limit:0), so **no in-code model swap
recovers the dead 6th leg** — the recovery is a Google-console action
(→ `blocked-by-human.md`). No code lever ships this run: removing Gemini from
the chain would touch the prod chain, whose `GEMINI_API_KEY` value the agent
can't read to rule out a working prod key (SK-LLM-039 alt-2 caution stands),
and the §5 eval-mirrors-prod guardrail blocks an eval-only removal. The
delivered delta is the measurement correction (recoverable-in-code Gemini
models: believed 1 → measured 0) propagated to its canonical homes
(SK-LLM-039 "Why" carried the now-false "2.0 access OK" claim; corrected).

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

- 2026-06-15 (run 7) — **pin-to-2.0 lever falsified (measure-first).** Run 6
  left "pin Gemini to `gemini-2.0-flash`" as the cheap recovery. Live re-probe
  before touching code: 2.0-flash / -001 return `429 limit: 0` (zero free-tier
  allowance, stable ×3), not a transient throttle — so both 2.5 (403) and 2.0
  are unusable; no in-code swap recovers the leg. **Measured delta:**
  recoverable-in-code Gemini models 1 → **0**. No code shipped (prod-chain
  removal needs an unreadable prod-secret check; §5 blocks eval-only removal).
  Correction propagated to SK-LLM-039 (false "2.0 access OK" read) +
  `blocked-by-human.md`. KPI: engine-quality (measurement honesty). None
  degraded.

- 2026-06-15 (run 6) — **`auth_denied` reason split (SK-LLM-039).** 401/403
  now classify as a distinct `auth_denied` reason so a dead provider reads
  `gemini:auth_denied`, not an opaque `http_4xx`. Deterministic (+3 llm
  tests); breaker behaviour byte-for-byte unchanged ⇒ zero EX regression.
- 2026-06-14 (run 5) — **tail transient retry (SK-LLM-038).** Router retries
  the chain tail once on `network`/`http_5xx`. BIRD EX **0.522 → best-case
  0.528** (+0.6 pp), worst-case unchanged. None degraded.
- 2026-06-13/14 (runs 1–4) — day-one scorecard (metrics 0 → 12); #5
  instrument fix (`last_queried_at` **0 → 93**); Spider "oversized-DDL"
  `no_sql` falsified; `no_sql` `provider:reason` per-lane tally bucketed.
  Full history: `progress/quality-score-verification-log.md`.
