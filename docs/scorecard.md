# Scorecard

Regenerated daily by [`/daily`](../.claude/commands/daily.md) step 1 from live
sources (D1, KV, CF GraphQL, `eval-baseline.ts`). One table, ≤ 5 KB.
Published distribution URLs land here when a queue entry ships.

**Weekly focus number:** *(none set — founder picks at the weekly session;
until then the daily lever targets the worst number below)*

**Worst number today:** real strangers reaching a first answer = **0**
(funnel/distribution lane), re-confirmed fresh below. The upstream wall is
distribution (≈0 genuine traffic → 0 genuine waitlist/signups), not the gate
(GLOBAL-027 valve is open). The engine worst (Spider 0.1704 vs 0.75) is
downstream; its biggest lever (the dead Gemini leg) stays **human-blocked**
(Google project denial — re-probed 06-16, still `403 PERMISSION_DENIED` in
prod *and* the agent env; not a key swap) and local EX is unmeasurable (no DB
fixtures). **Run 10 (shipped):** the funnel numbers had been carried/eyeballed
because the daily container firewalls Postgres TCP (:5432). `scripts/funnel-pull.sh`
pulls every funnel source over HTTPS instead (D1 + KV query APIs, Neon `/sql`),
bot-filtered — see the delta below.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-16** | | one HTTPS pull: `bash scripts/funnel-pull.sh` |
| 1 | Visits, 7d (CF Web Analytics) | 94/147 (06-15, carried) | RUM GraphQL field not exposed to the agent token → only source still not HTTPS-pullable here |
| 2 | Waitlist rows, real | **0 of 70** | 48 wshu.net + 20 web-library.net (mail.tm walkers), 1 founder, 1 test → 0 genuine |
| 3 | Registered users, real strangers | **0 of 7** | canonical D1 `user` (3 founder + 4 test/e2e); the Neon `users` copy (11, walker rows) is not the metric |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 12/wk (prev 26) | cap 200/wk — no exhaustion risk; mostly walker-triggered |
| 5 | Anon DBs with a recorded first answer | **102 of 102** | +1 since 06-15. Genuine-stranger subset still 0 (rows #2/#3) — the real worst-number |
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

- 2026-06-16 (run 10) — **HTTPS funnel puller (`scripts/funnel-pull.sh`).**
  The daily container firewalls Postgres TCP (:5432), so funnel rows were
  carried/eyeballed. New one-command pull hits every source over HTTPS (CF D1
  + KV query APIs, Neon `/sql`), bot-filtered. Surfaced two correctness fixes:
  (a) the canonical user count is D1 `user` (7), not the Neon `users` copy (11
  walker rows); (b) freshly re-measured — waitlist 69→70, invite-valve
  9→12/wk, anon first-answer 101→102 — all still **0 genuine strangers**. KPI:
  onboarding/observability (the instrument that tells us if onboarding works).
  None degraded (read-only pulls, no runtime change). Gemini re-probed 06-16:
  still `403` in prod + agent env (human-blocked).
- 2026-06-15 (run 9) — **park a denied provider on the first 401/403
  (SK-LLM-039 rev).** Gemini sat at chain index 1 (the `plan`/`schema_infer`
  hedge partner) yet `auth_denied` was kept out of the breaker, eating a
  guaranteed-failed round-trip + hedge slot on every call. Now the first
  denial opens the breaker, still surfacing `auth_denied` (not `circuit_open`).
  **Measured (unit test):** dead-key round-trips over 5 calls **5 → 1**; hedge
  slot rotates to the live provider. KPI: performance. None degraded.
- 2026-06-15 (runs 7–8) — seed-row salvage (SK-HDC-019; seeded 0→3 on a
  one-bad-of-four set) · pin-to-2.0 Gemini lever falsified (2.0-flash `429
  limit:0`; no in-code swap recovers the leg → SK-LLM-039).
- 2026-06-13/15 (runs 1–6) — day-one scorecard (metrics 0→12); #5 instrument
  fix (`last_queried_at` 0→93); Spider `no_sql` per-lane tally; tail transient
  retry (SK-LLM-038; BIRD EX 0.522→0.528 best-case). Full history:
  `progress/quality-score-verification-log.md`.
