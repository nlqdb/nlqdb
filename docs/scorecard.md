# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane) — gated by the engine (GLOBAL-027 valve), so the
engine-side worst, Spider 0.1704 vs 0.75, owns it. Run 6 root-causes the
Spider `gemini:http_4xx` losses (run-3 obs, the stated next lever): a live
probe (2026-06-15) shows the shared `GEMINI_API_KEY` project returns **403
`PERMISSION_DENIED`** ("project denied access") on the entire gemini-2.5
family (4/4 probes; gemini-2.0 returns 429 = access OK, quota-throttled).
Gemini is **dead weight in the chain** — it 403s every call, so the free
chain effectively runs 5-of-6 and `no_sql` inflates whenever the other 5
rate-limit together. The key fix is a Google-console/billing action
(→ `blocked-by-human.md`). This run ships **SK-LLM-039**: 401/403 now
classify as a distinct `auth_denied` reason, so the next eval's
`no_sql_reasons` bucket reads `gemini:auth_denied` (project locked out)
instead of an opaque `gemini:http_4xx`. Zero failover-behaviour change.

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
| 7 | Spider raw EX | 0.1704 | target 0.75; 36/135 `no_sql` — `gemini:http_4xx` **root-caused (run 6)** = 403 `PERMISSION_DENIED`, project denied gemini-2.5 access. Not size (≤1.9K tok). SK-LLM-039 makes it legible as `gemini:auth_denied`; key fix is console/billing (blocked-by-human) |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |

## Deltas (recent runs)

- 2026-06-13 (runs 1–3) — day-one scorecard (metrics 0 → 12); #5 instrument
  fix (`last_queried_at` NULL → seeded + backfilled, **0 → 93**, onboarding);
  #7 diagnosis correction (Spider "oversized-DDL" `no_sql` **falsified**).
- 2026-06-14 (run 4) — bucketed the persisted `no_sql` `provider:reason` tags
  into a per-lane tally. BIRD baseline → `mistral:network ×3`,
  `groq:circuit_open ×3`. KPI: engine-quality (measurement).
- 2026-06-14 (run 5) — **tail transient retry (SK-LLM-038).** Router retries
  the chain tail once on `network`/`http_5xx`. Deterministic: 5 new tests;
  BIRD EX **0.522 → best-case 0.528** (+0.6 pp), worst-case unchanged.
  KPI: engine-quality. None degraded.
- 2026-06-15 (run 6) — **`auth_denied` reason split (SK-LLM-039).** Live probe
  root-caused the Spider `gemini:http_4xx` losses: the shared `GEMINI_API_KEY`
  project is denied gemini-2.5 access (403 `PERMISSION_DENIED`, 4/4 probes).
  401/403 now classify as `auth_denied` so a dead provider reads
  `gemini:auth_denied`, not an opaque `http_4xx` (the run-3/4 "make the real
  cause legible" arc, one level deeper). **Measured:** deterministic — +3 llm
  tests prove 401/403→`auth_denied`, non-auth 4xx still→`http_4xx`, and the
  reason surfaces in the chain-failure summary (171/171 llm tests, 185/185
  eval tests green). Breaker behaviour byte-for-byte unchanged ⇒ zero
  failover/EX regression. Key fix (console/billing) → `blocked-by-human.md`.
  KPI: engine-quality (measurement/observability). None degraded.
</content>
