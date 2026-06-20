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
much of it value/literal/column grounding. **BIRD re-run 2026-06-19** on current
main (first canonical since T20–T22 merged): raw EX 0.522 → **0.520** (260/500),
`no_sql` 3 → 1 — **statistically flat** (McNemar p=0.50, b=38/c=37, no
regression). The directive levers (T13–T16/T22) have **saturated on BIRD**.
**2026-06-19 (run 18): the `SK-QUAL-014` literal axis falsifies value-retrieval
as the top lever** — of the 238 BIRD mismatches, `literal_diff` is the largest
tag (90) but `literal_case_only` is 6 and **`literal_only` is 0**: no mismatch
is recoverable by fixing string literals alone (each co-occurs with a structural
error). So value-sampling (§4 #2a) flips ~0 rows standalone; the path to the
gate floor is the §4 **reasoning** levers (#3 self-consistency, #1 retrieval
few-shot), not retrieval. Value-retrieval is demoted + privacy-gated.

| # | Metric | Value | Target / note |
|---|--------|-------|------|
| | **Funnel — bot-filtered, 2026-06-15** | | walkers = `flow-004-walker` source / `nlqdb-flow004-*` emails |
| 1 | Visits, 7d (CF Web Analytics) | 94 visits / 147 pageloads | was 114/175 (06-13); walker traffic aged out of the 7d window |
| 2 | Waitlist rows, real | 1 of 69 | 68 walker/test/probe; the 1 is the founder → ~0 genuine strangers |
| 3 | Registered users, real strangers | 0 | 7 total = 3 founder + 4 test/dev accounts |
| 4 | Invite-valve crossings (KV `wl:invite-cap`) | 9/wk (06-13, carried) | cap 200/wk — no exhaustion risk; mostly walker-triggered; not re-pulled this run |
| 5 | Anon DBs with a recorded first answer | **101 of 101** | instrument fix (runs 1–3) holding; +8 since 06-13. Genuine-stranger subset still ~0 (rows #2/#3) — the real worst-number |
| | **Engine — BIRD 2026-06-19 · Spider 2026-06-17 (both fresh, < 7d)** | | `apps/api/src/gate/eval-baseline.ts` |
| 6 | BIRD raw EX | 0.520 | target 0.65; was 0.522 (06-12). Canonical re-run on current main (T20–T22): 260/500, `no_sql` 3 → 1. **Flat within variance** — McNemar b=38/c=37, p=0.50, no regression. Directive levers saturated ⇒ retrieval levers (§4 #2a) next |
| 7 | Spider raw EX | 0.1852 | target 0.75; was 0.1704 (06-12). Gemini free-tier key restored 06-17 → `no_sql` 36 → 9, `gemini:http_4xx` cleared (`SK-LLM-039`); residual 9 capacity-only. Bottleneck now SQL reasoning, not availability |
| 8 | persona-bench | — | not yet built |
| 9 | free-vs-frontier delta | null | agentic lane not yet run (`SK-QUAL-004`, target ≤ 25 pp) |
| | **Ops — 7d, CF Workers analytics** | | wall-time, all routes (not `/ask`-only) |
| 10 | nlqdb-api requests / errors | 2,268 / 0 (0.00%) | mcp 284 req, events-worker 91 req, both 0 err |
| 11 | nlqdb-api latency p50 / p95 | 666 ms / 7.05 s (06-13) | p95 dominated by LLM-bound asks; `/ask`-only split needs Grafana `metrics:read` (agent has write-only key) |
| 12 | $ spend | ~$0 | free tiers across CF / Neon / LLM chain |
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 5 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 5 / 13 | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
| WS-05 | carousel analytics-over-memory slides | ✅ | run 26 — 2 analytics-over-memory slides (`GROUP BY category` + top-N `ORDER BY … LIMIT 5`), MCP surface; data-only `showcase-examples.ts` |
| WS-06 | Mem0 \| Zep \| Letta \| nlqdb capability matrix | 🟡 1/2 | run 27 — **data ✅** (`agentMemoryMatrix.ts`, 9 honest rows + test); render component pending |
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

- 2026-06-20 (run 27) — **WS-06 run 1/2: shipped the agent-memory capability
  matrix data** (`apps/web/src/data/agentMemoryMatrix.ts`). WS-06 ⬜ → **🟡 1/2**
  (data ✅, render component pending — run 2). Engine lane blocked (BIRD 06-19 +
  Spider 06-17 both < 7 d; §5 forbids a back-to-back eval dispatch); WS-03 (#423)
  and WS-05 (#424) merged ahead of this run, so per the pivot INDEX pickup rule
  WS-06 is the lowest-numbered ⬜ with its prereq (WS-01 ✅) met — it adds a
  brand-new file. New typed structure per **SK-PIVOT-001** (a four-column matrix,
  *not* a hacked single-`them` `/vs` template): `MatrixRow { capability; mem0;
  zep; letta; nlqdb; note? }` reusing `ComparisonClaim`, 9 honest rows +
  `MATRIX_VERIFIED_ON = 2026-06-19`. Rows ordered so the table's shape is the
  argument: recall is table stakes (all four ✓), the analytical wedge (top-N,
  GROUP BY/JOIN/HAVING, per-group aggregation, time-window, schema design, diff
  preview) is nlqdb-only. **Honesty correction vs the aspirational framing doc**
  (P2 / AEO): the self-host row is sourced from WS-01's web-verified
  `competitors.md §4` — Mem0 / Letta / LangMem are OSI-licensed (✓), Zep
  self-hosts only the Graphiti engine (◐), and nlqdb is FSL source-available, not
  yet OSI (◐, GLOBAL-019) — *not* the framing doc's "nlqdb ✓ / others ❌".
  `agentMemoryMatrix.test.ts` locks the invariants (every cell a valid claim, ≥5
  nlqdb-only wedge rows, recall is table stakes, verifiedOn < 60 d). Gates: web
  **122 → 126** tests, astro-check 0/0/0, biome lint clean. KPI: **onboarding /
  UX** (GLOBAL-025) — the matrix is the wedge's most persuasive comprehension
  asset (renders in run 2 on `/agents` + the blog); **none degraded** (additive,
  unreferenced file — no code path, engine, chain, or scorer touched; BIRD 06-19
  + Spider 06-17 untouched; performance N/A). Pivot counters unchanged at
  **5/20** + **5/13** (WS-06 is a half-step; the worksheet ticks ✅ only at run 2
  render). Artifact: a "comparison table" Show-HN/Reddit draft appended to the
  distribution queue (seeds the WS-09 HN post).
- 2026-06-20 (run 26) — **WS-05: analytics-over-agent-memory carousel slides**
  (Pivot messaging track 4 → **5/13**; Pivot 4 → **5/20**). Engine lane blocked
  (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), so the in-bounds lever is funnel/distribution. WS-03 closed in the
  prior run (run 25), so per the pivot INDEX pickup rule WS-05 is the
  lowest-numbered ⬜ with prereqs (none) met — it touches only
  `apps/web/src/data/showcase-examples.ts`. Added two `read` slides on the home
  carousel against an `agent_memory`-style table:
  `read-agent-memory-by-category` (`GROUP BY category … ORDER BY facts DESC`) and
  `read-agent-memory-top-recalled` (`GROUP BY content … ORDER BY recalls DESC
  LIMIT 5`), both MCP surface (`db_agents`). The wedge — *the math runs in
  Postgres, not as arithmetic in the model's head* — now rotates through the
  home's headline visual alongside the existing recall slide. **Data-only**,
  additive, reuses the existing typewriter mechanism; brand/animation untouched.
  `@nlqdb/web` 122 tests · astro-check 0/0/0 · biome clean. KPI: onboarding
  / UX (carousel comprehension for the agent-builder reader); engine + perf
  untouched (BIRD 06-19 / Spider 06-17 unchanged). Artifact: an X/Bluesky
  "your agent's memory should be able to GROUP BY" thread appended to the
  distribution queue. Next pivot lever is WS-06 (capability matrix).
- 2026-06-20 (run 25) — **WS-03 run 2/2: shipped the analytical sibling solve page
  `/solve/analytical-queries-over-agent-memory` — WS-03 closed** (Pivot messaging
  track 3 → **4/13**; Pivot 3 → **4/20**; solve pages 5 → **6**). Engine lane
  blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), so the in-bounds lever is funnel/distribution; per the pivot INDEX
  pickup rule WS-03 was the lowest-numbered in-progress worksheet (🟡 1/2) with its
  prereq (none) met, and run 1 (the sharpen) shipped the write-side page, so run 2
  is the read-side sibling. Added one `SolveEntry` (`apps/web/src/data/solve.ts`,
  persona P2) — slug `analytical-queries-over-agent-memory`, `searchTitle` the NL
  query "How do I run reports over what my AI agent remembered?". The wedge is the
  **read side**: an agent that already logs memory needs *reports* over it
  (counts / top-N / averages per group); a vector store returns top-k similar rows
  with no query planner, so the rollup becomes the LLM doing arithmetic over search
  hits — nlqdb runs the actual `GROUP BY` in Postgres and shows the SQL. `demoGoal`
  = "count of facts the agent logged per category this month, highest first";
  cross-links the write-side `give-ai-agent-persistent-memory`. `whatItDoesnt` kept
  honest (no native vector search → Mem0/pgvector; no prebuilt charting). Real tool
  names only. Sitemap + `llms.txt` pick up the slug automatically; wired into
  `verify-flows.sh` SOLVE_SLUGS + `flow-002.ts` SLUG_DEMO_GOAL (also fixed the
  run-1 demoGoal drift in that mirror). Gates: web 122 tests, astro-check 0/0/0,
  stranger-test typecheck, lint all green. KPI: **onboarding** (GLOBAL-025) — a new
  AEO/decision-moment on-ramp for the P2 "analytics over agent memory" search
  intent; **none degraded** (additive content on the existing template — no code
  path, engine, chain, or scorer touched; BIRD 06-19 + Spider 06-17 untouched;
  performance N/A). Artifact: an r/AI_Agents "reporting over agent memory"
  helpful-answer draft appended to the distribution queue. **WS-03 closes**; next
  pivot lever is WS-05 (carousel) — the lowest-numbered ⬜ with prereqs met.
- 2026-06-19/20 (runs 19–24) — **agent-memory pivot messaging wave (WS-01→WS-04), engine lane eval-gated throughout** (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids back-to-back eval dispatch), so each run took the lowest-numbered ⬜ worksheet on the funnel/distribution lane. **WS-01** (run 19) anchored the Zep/Letta/LangMem cluster in `competitors.md §4` (Pivot 0→1/20). **WS-02** (runs 20–22) shipped the three memory `/vs` pages — `/vs/zep`, `/vs/letta`, `/vs/langmem` (one competitor per run, SK-PIVOT-002; Memory /vs pages 0→3/3, messaging →2/13), every claim web-verified 06-19 and keyed to the retrieval-vs-analytics wedge with real tool names only. **WS-03 run 1** (run 23) sharpened `give-ai-agent-persistent-memory` to the analytical wedge + fixed phantom MCP tool names (SK-PIVOT-002 honesty rule). **WS-04** (run 24) reframed the MCP surface to "analytical memory" — copy-only on the stable SK-MCP-002 contract (33 MCP tests green; messaging →3/13). All additive content/copy; no engine/chain/scorer touched. Full per-run detail in git history.
- 2026-06-19 (runs 17–18) — **engine measurement, no EX-moving dispatch.** Run 17: first canonical BIRD re-run since T20–T22 merged — raw EX 0.522→0.520 (260/500), `no_sql` 3→1, **statistically flat** (McNemar p=0.50, no regression); finding: prompt-directive levers (T13–T16/T22) have **saturated on BIRD**. Run 18: added the literal-grounding axis to the `SK-QUAL-014` classifier — `literal_diff` is the largest mismatch tag (90/38%) but `literal_only` = **0**, **falsifying value-retrieval (§4 #2a) as a standalone lever** (it flips ~0 rows; demoted below the §4 reasoning levers + privacy-gated). Detail in `progress/quality-score-verification-log.md`.
- 2026-06-16/18 (runs 11–16) — engine-instrument + deferred-lever wave, all
  detailed in `progress/quality-score-verification-log.md`: execution-guided
  PG-error repair (run 11, SK-ASK-022; `db_unreachable → rows`) · **Gemini
  free-tier key restored + Spider re-run** (run 12; raw EX 0.1704 → **0.1852**,
  `no_sql` 36 → 9) · join-bridge pruner recall (run 13, SK-LLM-037 rev / T21) ·
  HAVING planner directive (run 14, SK-LLM-040 / T22) · mismatch error-class
  classifier (run 15, SK-QUAL-014; `fewer_tables` 105 → 35) · column-coverage
  harness (run 16, SK-QUAL-015; 59.8% name-recall + 27.4% key re-admit, 12.8%
  value-only floor). Net read by run 16: value-retrieval ranks ahead of
  column-pruning — later falsified standalone by run 18.
- 2026-06-15/16 (runs 7–10) — provider-resilience wave: pin-to-2.0 falsified
  (run 7) → park a denied provider on the first 401/403 (run 9, SK-LLM-039)
  with a 30-min cooldown (run 10; dead-key round-trips 10 → 1) ·
  deterministic seed-row salvage (run 8, SK-HDC-019; 0 → 3).
- 2026-06-13/15 (runs 1–6) — day-one scorecard (metrics 0 → 12); #5 instrument
  fix (`last_queried_at` 0 → 93); tail transient retry (SK-LLM-038; BIRD EX
  0.522 → 0.528 best-case). Full history:
  `progress/quality-score-verification-log.md`.
