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
| | **Pivot — agent-memory wedge** (GLOBAL-036) | 4 / 20 + 3 memory /vs pages | tick ⬜→✅ with PR link on merge; mirrors `docs/features/agent-memory-pivot/worksheets/INDEX.md` |
| | *Messaging track — WS-\** | 4 / 13 | pick when worst number is funnel / distribution |
| WS-01 | competitors.md anchor (Zep / Letta / LangMem) | ✅ | run 19 — §4 + threat matrix; unblocks WS-02 |
| WS-02 | memory `/vs` pages (one per run) | ✅ 3/3 | run 20 — **Zep ✅** (`/vs/zep`); run 21 — **Letta ✅** (`/vs/letta`); run 22 — **LangMem ✅** (`/vs/langmem`) — WS-02 closed |
| WS-03 | solve pages — sharpen + sibling | ✅ 2/2 | run 23 — **sharpen ✅**; run 25 — **analytical sibling ✅** (`analytical-queries-over-agent-memory`, the read-side report-over-memory wedge) |
| WS-04 | MCP tool + package + docs framing | ✅ | run 24 — three tool descriptions + `package.json` desc + `mcp.mdx` intro now lead with "analytical memory" (copy only; SK-PIVOT-003) |
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
- 2026-06-19 (run 24) — **WS-04: reframed the MCP surface to "analytical
  memory"** (Pivot messaging track 2 → **3/13**; Pivot 2 → **3/20**). Engine lane
  blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), so the in-bounds lever is funnel/distribution. WS-02 (LangMem,
  PR #420) and WS-03 (solve pages, PR #421) are both in flight, so per the pivot
  INDEX pickup rule WS-04 is the lowest-numbered ⬜ with prereqs (none) met that
  **doesn't collide** with the open PRs — it touches only `packages/mcp/` +
  `apps/docs/mcp.mdx`, not `competitors.ts` / `solve.ts`. **Copy only**
  (SK-PIVOT-003): prepended a memory-shaped lead clause to all three tool
  `description`s + `title`s in `packages/mcp/src/server.ts` (`nlqdb_query`:
  "Query your agent's structured memory in natural language — a real database it
  can GROUP BY / JOIN / aggregate over, not just recall"), rewrote the
  `package.json` description, and led the `mcp.mdx` intro with "the memory MCP
  server". **No tool renamed, no schema/annotation/behaviour change** — the
  stable `SK-MCP-002` contract is intact and the 33 MCP protocol tests stay
  green. GLOBAL-003 parity verified: no other code surface hard-codes the old
  blurb (`grep "Run a natural-language query"` → only server.ts + planning docs).
  Gates: `@nlqdb/mcp` test 33/33, typecheck clean, biome lint clean on the
  changed files. KPI: **onboarding** (GLOBAL-025) — the highest-leverage
  agent-facing string now signals the wedge at tool-discovery time;
  **none degraded** (copy on a stable contract — no engine, chain, scorer, or
  request path touched; BIRD 06-19 + Spider 06-17 untouched; performance N/A).
  Artifact: an MCP-directory listing-refresh blurb appended to the distribution
  queue. WS-05 (carousel) is the next ⬜ messaging worksheet.
- 2026-06-19 (run 23) — **WS-03 run 1/2: sharpened the agent-memory solve page to
  the analytical-memory wedge + fixed phantom MCP tool names.** Engine lane still
  blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back eval
  dispatch), and WS-02's last slice (LangMem) is in flight on an open PR — so the
  in-bounds, non-overlapping lever is WS-03, the next ⬜ funnel/distribution
  worksheet with its prereqs met. Reframed `give-ai-agent-persistent-memory`
  (`apps/web/src/data/solve.ts`, persona P2) from generic "complementary, not
  replacement" to the wedge: the agent stores typed rows and later **aggregates**
  them (`GROUP BY` / top-N / per-period) — retrieval ≠ analytics. `painContext`,
  `oneLiner`, `demoGoal` (now `top 5 things the agent remembered this week by
  frequency`), `demoWhy`, and the FAQ all lead with the analytical split; added a
  new "Why can't a vector store answer 'average per group'?" FAQ. **Honesty fix
  (also an `SK-PIVOT-002` rule):** the page cited **phantom MCP tools**
  (`create_database` / `ask` / `run`) that don't exist — corrected to the real
  three (`nlqdb_query` / `nlqdb_list_databases` / `nlqdb_describe`), with
  provisioning honestly framed as `nlqdb_query` with no `db` set (provisions
  Postgres from the agent's first goal). `whatItDoesnt` kept honest (no native
  vector search → Mem0/pgvector; no per-row TTL yet). Gates: web 122 tests,
  astro-check 0/0/0, lint clean on the edited file. KPI: **onboarding**
  (GLOBAL-025) — a sharper P2 decision-moment on-ramp; **none degraded** (copy/data
  on the existing template — no code path, engine, chain, or scorer touched; BIRD
  06-19 + Spider 06-17 untouched; performance N/A). Artifact: an r/LangChain
  "vector store can't aggregate its own memory" helpful-answer draft appended to
  the distribution queue. The analytical-queries sibling is WS-03 run 2.
- 2026-06-19 (run 22) — **WS-02 slice 3/3: shipped `/vs/langmem` — WS-02 closed**
  — the third and final agent-memory `/vs` page (Pivot `Memory /vs pages` 2 →
  **3/3**; WS-02 ✅ → messaging track 1 → **2/13**; pivot worksheets 1 →
  **2/20**). Engine lane still blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5
  forbids a back-to-back eval dispatch), so the in-bounds lever is
  funnel/distribution; per the pivot INDEX pickup rule WS-02 was the
  lowest-numbered in-progress worksheet with its prereq (WS-01 ✅) met, and
  "one competitor per run" (SK-PIVOT-002) makes LangMem the last slice. Added one
  `Competitor` entry (`apps/web/src/data/competitors.ts`, persona P2) — slug
  `langmem`, the wedge keyed on **retrieval vs analytics**: LangMem is an
  open-source LangChain SDK whose LLM-managed semantic/episodic/procedural memory
  *retrieves* facts by similarity (and a background manager consolidates them) but
  has no relational query layer, so an agent can't `GROUP BY`/`JOIN`/`HAVING` over
  its own memory; nlqdb is the real DB it aggregates over, and the two compose
  (LangMem the memory layer inside a LangGraph agent, nlqdb the analytical store).
  Facts web-verified 06-19; honest calls: LangMem is an **in-process Python SDK
  with no MCP server of its own** (`them: no`, distinct from Zep/Letta which got
  `partial`) and is **LangGraph BaseStore-coupled** (the framework-lock wedge).
  Real tool names only (`nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no
  phantom `create_database`). Sitemap + `llms.txt` pick up the slug automatically;
  slug wired into `verify-flows.sh` + `tools/stranger-test/src/flows/flow-003.ts`.
  Gates: astro-check 0/0/0, web 122 tests, stranger-test typecheck, lint all
  green. KPI: **onboarding** (GLOBAL-025) — a new AEO/decision-moment on-ramp for
  the P2 agent-builder keyword "LangMem alternative"; **none degraded** (additive
  content on the existing template — no code path, engine, chain, or scorer
  touched; BIRD 06-19 + Spider 06-17 untouched; performance N/A). Artifact: an
  r/LangChain / Show-HN nlqdb-vs-LangMem comparison draft appended to the
  distribution queue. **WS-02 closes**; next pivot lever is the lowest-numbered ⬜
  worksheet (WS-03 solve pages or WS-04 MCP framing, both prereq-free).
- 2026-06-21 (run 21) — **WS-02 slice 2/3: shipped `/vs/letta`** — the second
  agent-memory `/vs` page (Pivot `Memory /vs pages` 1 → **2/3**; WS-02 🟡 1/3 →
  2/3). Engine lane still blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5
  forbids a back-to-back eval dispatch), so the in-bounds lever is
  funnel/distribution; per the pivot INDEX pickup rule WS-02 is the
  lowest-numbered in-progress worksheet with its prereq (WS-01 ✅) met, and
  "one competitor per run" (SK-PIVOT-002) makes Letta the next slice. Added one
  `Competitor` entry (`apps/web/src/data/competitors.ts`, persona P2) — slug
  `letta`, the wedge keyed on **retrieval vs analytics**: Letta is a stateful
  agent runtime (ex-MemGPT, Apache-2.0) whose OS-style memory tiers (core /
  recall / archival) *retrieve* facts but have no relational query layer, so an
  agent can't `GROUP BY`/`JOIN`/`HAVING` over its own memory; nlqdb is the real
  DB it aggregates over, and the two compose (Letta the runtime, nlqdb the
  store). Facts web-verified 06-19 that Letta **does** support MCP integration
  → the row is honest (`them: partial`); differentiator is provisioning + SQL,
  named with real tool names (`nlqdb_query`/`nlqdb_list_databases`/
  `nlqdb_describe`, no phantom `create_database`). Sitemap + `llms.txt` pick up
  the slug automatically; slug wired into `verify-flows.sh` +
  `tools/stranger-test/src/flows/flow-003.ts`. Gates: astro-check 0/0/0, web
  122 tests, stranger-test typecheck, lint all green. KPI: **onboarding**
  (GLOBAL-025) — a new AEO/decision-moment on-ramp for the P2 agent-builder
  keyword "Letta alternative"; **none degraded** (additive content on the
  existing template — no code path, engine, chain, or scorer touched; BIRD
  06-19 + Spider 06-17 untouched; performance N/A). Artifact: an r/AI_Agents /
  Show-HN nlqdb-vs-Letta comparison draft appended to the distribution queue.
  LangMem is the last WS-02 run.
- 2026-06-20 (run 20) — **WS-02 slice 1/3: shipped `/vs/zep`** — the first
  agent-memory `/vs` page (Pivot `Memory /vs pages` 0 → **1/3**). Engine lane
  blocked (BIRD 06-19 + Spider 06-17 both < 7 d; §5 forbids a back-to-back
  eval dispatch), so the in-bounds lever is funnel/distribution; per the pivot
  INDEX pickup rule WS-02 is the lowest-numbered ⬜ with its prereq (WS-01 ✅)
  met. Added one `Competitor` entry (`apps/web/src/data/competitors.ts`, persona
  P2) — slug `zep`, the wedge keyed on **retrieval vs analytics**: Zep's Graphiti
  temporal knowledge graph recalls facts but has no query planner, so an agent
  can't `GROUP BY`/`JOIN`/`HAVING` over its own memory; nlqdb is the real DB it
  aggregates over. Web-verified 06-19 that Zep **does** ship an experimental
  Graphiti MCP server (graph add/search) → the row is honest (`them: partial`,
  not "no MCP"); differentiator is provisioning + SQL, named with real tool
  names (`nlqdb_query`/`nlqdb_list_databases`/`nlqdb_describe`, no phantom
  `create_database`). Sitemap + `llms.txt` pick up the slug automatically; slug
  wired into `verify-flows.sh` + `tools/stranger-test/flow-003.ts`. Gates: astro
  -check 0/0/0, web 122 tests, stranger-test typecheck, lint all green. KPI:
  **onboarding** (GLOBAL-025) — a new AEO/decision-moment on-ramp for the P2
  agent-builder keyword "Zep alternative"; **none degraded** (additive content
  on the existing template — no code path, engine, chain, or scorer touched;
  BIRD 06-19 + Spider 06-17 untouched; performance N/A). Artifact: an r/AI_Agents
  / Show-HN nlqdb-vs-Zep comparison draft appended to the distribution queue.
  Letta + LangMem are the next two WS-02 runs.
- 2026-06-19 (run 19) — **WS-01: anchored the agent-memory cluster (Zep / Letta /
  LangMem) in `docs/competitors.md §4`** — the pivot's first shipped slice (Pivot
  0/20 → **1/20**). The engine NL→SQL lane (the worst number's root cause) is
  blocked today: BIRD ran 06-19, Spider 06-17 (both < 7 d), and §5 forbids a
  back-to-back eval dispatch, so no engine delta is measurable this run and the
  two next engine levers (§4 #1 retrieval few-shot, #3 self-consistency) each need
  an eval. Per the pivot INDEX pickup rule (lowest-numbered ⬜ worksheet with all
  prereqs ✅), the in-bounds lever is the funnel/distribution lane — WS-01, the
  documented strategic answer to the engine-gated funnel zero. Sharpened Zep
  (Graphiti temporal knowledge graph, 27k+ ⭐, ~$125/mo, benchmark-led) with a
  real `Gap nlqdb exploits`; completed Letta (Apache-2.0, OS-style core/recall/
  archival tiers); **added the missing LangMem entry** (LangChain SDK — semantic/
  episodic/procedural, distribution moat); added Letta + LangMem threat-matrix
  rows (Zep/Mem0 already present). Every entry keyed to **P2** with the
  analytical-SQL wedge (`GROUP BY`/`JOIN`/`HAVING` over memory — retrieval ≠
  analytics) as the win-zone; landscape facts web-verified 06-19 (§4 last-verified
  bumped). **This unblocks WS-02** (memory `/vs` pages, which move the funnel
  `Pivot:` line) — WS-01 itself moves no funnel number directly (it is the
  measurement-enabling prerequisite, per the worksheet). KPI: **onboarding**
  (GLOBAL-025) — a sharper single-story wedge for the P2 on-ramp; **none degraded**
  (additive docs only — no code, no engine/chain/scorer change; BIRD 06-19 +
  Spider 06-17 untouched; performance N/A). Artifact: an agent-memory landscape
  note appended to the distribution queue (seeds the WS-09 blog post).
- 2026-06-19 (run 18) — **literal-grounding axis on the `SK-QUAL-014` classifier
  — falsifies value-retrieval (§4 #2a) as the top lever, deterministically and
  with zero quota.** The last four runs ranked value-retrieval #1 off the
  `SK-QUAL-015` column-*name* ceiling (12.8% of needed cols named by value,
  *theoretical*). But that was never checked against real predicted-vs-gold
  output. This run adds the missing axis: `classifyMismatch` now diffs
  case-preserved string-literal multisets (`literal_diff` / `literal_case_only`)
  and exports `isLiteralOnly(pred, gold)`. Run on the committed 06-19 BIRD
  baseline (238 mismatches, gold joined offline): `literal_diff` is the
  **largest** single tag (**90 / 38%**) — yet `literal_case_only` = **6** and
  **`literal_only` = 0**. *No* mismatch is recoverable by fixing literals alone;
  every literal error co-occurs with a structural one (the 90 split ~16
  date-encoding `'2019-8-20'`/LIKE-shape + ~68 categorical value diffs riding
  alongside a wrong column/predicate/grain). So a sample-value prompt flips ~0
  rows standalone — value-retrieval is **demoted below the reasoning levers**
  (§4 #3 self-consistency, #1 retrieval few-shot) and, on the prod side, blocked
  on an unresolved privacy decision (feeding user cell-values to the free chain).
  The `other_predicate_or_value` catch-all shrank 42 → 30. KPI: engine quality
  (GLOBAL-025) — sharper instrument → evidence-driven lever selection that
  *prevents* a large prod build for ~0 EX; **none degraded** (read-only over the
  committed baseline + downloadable gold; no chain/scorer/runner change; EX
  unchanged, no eval dispatched — BIRD 06-19 + Spider 06-17 both < 7 d). 18 eval
  tests green (was 14). Re-points source-of-truth §2/§4/§6 + verification-log.
- 2026-06-19 (run 17) — **first canonical BIRD re-run since T20–T22 merged —
  discharges 4 runs of deferred-EX debt.** Runs 13/14 shipped engine levers
  (T21 join-bridge recall, T22 HAVING directive) and explicitly punted their
  real EX delta to "the next scheduled eval"; this is that eval. Dispatched the
  full 500-q BIRD run on current main (336c489) via `GH_TOKEN_WORKFLOW`,
  resumed across **3 quota windows** (SK-QUAL-013, 407 → 479 → 500). Result:
  raw EX **0.522 → 0.520** (261 → 260/500), `no_sql` **3 → 1**, exec_error 1.
  The official baseline diff is **statistically flat** — McNemar b=38 (newly
  wrong) / c=37 (newly right), **p=0.50**, `regressions: []` — i.e. the 75
  flipped questions are pure provider-mix churn (greedy temp=0, but the free
  chain's live-provider set varies per run), **not** a lever effect. **Finding:
  the prompt-directive levers (T13–T16, T22) have saturated on BIRD** — three
  canonical runs now cluster at 261/263/260 of 500 — confirming the
  `SK-QUAL-015`/`SK-QUAL-014` read that the remaining loss is value/grounding,
  so the path to the 0.65 gate floor is the **§4 #2a value-retrieval** lever,
  not more directives. Re-seeds `eval-baseline.ts` + `baseline-2026-06-15.json`
  + the GLOBAL-027 mirror; updates source-of-truth §2/§6 + verification-log.
  KPI: engine quality (GLOBAL-025) — measurement refreshed (clears the stale
  06-12 BIRD `measured_at`) + evidence re-confirms the lever ranking; **none
  degraded** — the −1 question is McNemar-confirmed noise (p=0.50), and
  `no_sql` 3 → 1 is a small availability gain. No engine/chain code changed.
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
